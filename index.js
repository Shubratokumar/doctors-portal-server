const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 5000;
const nodemailer = require('nodemailer');
const sgTransport = require('nodemailer-sendgrid-transport');
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// middleware
app.use(cors());
app.use(express.json());

// Database Connection : MongoDB
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xczhe.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

// JWT verifing function
const verifyJWT = (req,res, next) =>{
  const authHeader = req.headers.authorization;
  if(!authHeader){
    return res.status(401).send({message: "Unauthorized Access"});
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded)=>{
    if(err){
      return res.status(403).send({message: "Forbidden Access"});
    }
    console.log(decoded);
    req.decoded = decoded;
    next();
  })
}

// Email sender 
const emailSenderOptions = {
  auth: {
    api_key: process.env.EMAIL_SENDER_KEY
  }
}

const emailClient = nodemailer.createTransport(sgTransport(emailSenderOptions));

// Email send for confirm appointment
const sendAppointmentEmail = (booking) =>{
 const {treatment, date, patientEmail, patientName, slot} = booking;

 var email = {
  from: process.env.EMAIL_SENDER,
  to: patientEmail,
  subject: `Your Appointment for ${treatment} is on ${date} at ${slot} is Confirmed.`,
  text: `Your Appointment for ${treatment} is on ${date} at ${slot} is Confirmed.`,
  html: `
    <div>
      <p> Hello ${patientName}, </p>
      <h3>Your Appointment for ${treatment} is consfirmed.</h3>
      <p>Looking forward to seeing you on ${date} at ${slot}.</p>

      <h3>Our Address</h3>
      <p>Dhaka Contonment</p>
      <p>Dhaka - 1206</p>
      <a href = "https://shubratokumar.com">unsubscribe</a>
    </div>
  `
};

emailClient.sendMail(email, function(err, info){
  if (err ){
    console.log(err);
  }
  else {
    console.log('Message sent: ', info);
  }
});

}

// Payment Confirmation Email 
const sendPaymentConfirmationEmail = (booking) =>{
  const {treatment, date, patientEmail, patientName, slot} = booking;
 
  var email = {
   from: process.env.EMAIL_SENDER,
   to: patientEmail,
   subject: `We have received your payment for ${treatment} is on ${date} at ${slot} .`,
   text: `Your payment for ${treatment} is on ${date} at ${slot} is Confirmed.`,
   html: `
     <div>
       <p> Hello ${patientName}, </p>
       <h3>Your Appointment for ${treatment} is confirmed.</h3>
       <h3>We have received your payment for ${treatment} .</h3>
       <p>Looking forward to seeing you on ${date} at ${slot}.</p>
 
       <h3>Our Address</h3>
       <p>Dhaka Contonment</p>
       <p>Dhaka - 1206</p>
       <a href = "https://shubratokumar.com">unsubscribe</a>
     </div>
   `
 };
 
 emailClient.sendMail(email, function(err, info){
   if (err ){
     console.log(err);
   }
   else {
     console.log('Message sent: ', info);
   }
 });
 
 }

async function run() {
    try {
        await client.connect();
        const serviceCollection = client.db("doctors_portal").collection("services");
        const bookingCollection = client.db("doctors_portal").collection("bookings");
        const userCollection = client.db("doctors_portal").collection("users");
        const doctorCollection = client.db("doctors_portal").collection("doctors");
        const paymentCollection = client.db("doctors_portal").collection("payments");

        /*******************************************************************************
         ****************************** API Naming Convention **************************
         * app.get('/booking') // get all bookings in this collection. or get more than one or by filter.
         * app.get('/booking/:id') // get a specific booking
         * app.post('/booking') // add a new booking
         * app.patch('/booking/:id') // update specific info a booking
         * app.put('/booking/:id') // upsert ==> update (if exists) or insert (if doesn't exist)
         * app.delete('/booking/:id') // delete a specific booking
         * 
        *******************************************************************************/
        //  middleware
        const verifyAdmin = async(req, res, next) =>{
          const requester = req.decoded.email;
          const requesterAccount = await userCollection.findOne({email : requester});
          if(requesterAccount.role === 'admin'){
            next();
          }
          else{
            res.status(403).send({message : "Forbidden Access"});
          }
        }

        // GET : Load all data
        app.get("/service", async(req,res) =>{
            const query = {};
            const cursor = serviceCollection.find(query).project({ name: 1 });
            const services = await cursor.toArray();
            res.send(services)
        })

        // GET : filtered available services
        app.get('/available', async(req, res)=>{
          const date = req.query.date ;

          // step 1: get all services
          const services = await serviceCollection.find().toArray();

          // step 2: get the booking of that day. output : [{}, {}, {}, {}, {}, {}]
          const query = {date: date};
          const bookings = await bookingCollection.find(query).toArray();

          // step 3: for each service
          services.forEach(service =>{
            // step 4: find booking for that service. output : [{}, {}, {}]
            const serviceBookings = bookings.filter(booking => booking.treatment === service.name);
            // step 5: select slots for the service bookings : ["", "", "", ""]
            const bookedSlots = serviceBookings.map(book => book.slot);
            // step 6: select those slots that are not in bookedSlots
            const available = service.slots.filter(slot => !bookedSlots.includes(slot));
            // step 7: set available to slots to make it easier
            // service.available = available;
            service.slots = available;
          })

          res.send(services);
        })

        // GET : filter bookings only specific user
        app.get('/booking', verifyJWT, async(req,res)=>{
          const patientEmail = req.query.patientEmail;
          const decodedEmail = req.decoded.email;
          if(patientEmail === decodedEmail){
            // const query = {patientEmail};
            // const bookings = await bookingCollection.find(query).toArray();
            const bookings = await bookingCollection.find({patientEmail}).toArray();
            return res.send(bookings);
          } else {
            return res.status(403).send({message: "Forbidden Access"});
          }
        });

        // GET : to find specific bookings
        app.get("/booking/:id", verifyJWT, async(req,res)=>{
          const id = req.params.id;
          const query = {_id: ObjectId(id)};
          const booking = await bookingCollection.findOne(query);
          res.send(booking);
        })

        // POST : add new booking
        app.post('/booking', async(req,res) =>{
          const booking = req.body;
          const query = { treatment: booking.treatment, date: booking.date, patientName : booking.patientName };
          const exists = await bookingCollection.findOne(query);
          if(exists){
            return res.send({success: false, booking: exists })
          }
          const result = await bookingCollection.insertOne(booking);
          sendAppointmentEmail(booking);
          return res.send({success: true, result});
        });

        // PATCH : update booking after paid
        app.patch('/booking/:id', verifyJWT, async(req, res)=>{
          const id = req.params.id;
          const payment = req.body;
          const filter = {_id : ObjectId(id)};
          const updateDoc = {
            $set: {
              paid : true,
              transactionId : payment.transactionId,
            },
          };
          const result = await paymentCollection.insertOne(payment);
          const updateBooking = await bookingCollection.updateOne(filter, updateDoc);
          res.send(updateDoc)
        })

        // GET : Load All user
        app.get('/user', verifyJWT, async(req, res) =>{
          const users = await userCollection.find().toArray();
          res.send(users);
        })

        //  GET : Only Admin
        app.get('/admin/:email', async(req,res)=>{
          const email = req.params.email;
          const user = await userCollection.findOne({email : email});
          const isAdmin = user.role === "admin";
          res.send({admin: isAdmin})
        })

        // PUT : Role admin set
        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async(req,res) =>{
          const email = req.params.email;
            const filter = { email };
            const updateDoc = {
              $set: {role : "admin"},
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        // PUT : Upsert ==> update or insert
        app.put('/user/:email',  async(req,res) =>{
          const email = req.params.email;
          const user = req.body;
          const filter = { email };
          const options = { upsert: true };
          const updateDoc = {
            $set: user,
          };
          const result = await userCollection.updateOne(filter, updateDoc, options);
          const token = jwt.sign({email: email}, process.env.ACCESS_TOKEN_SECRET,
            {expiresIn : '1d'}
            )
          res.send({result, token});
        });

        // DELETE : delete a user by admin

        // GET : load all doctor
        app.get('/doctor',verifyJWT, verifyAdmin, async(req, res)=>{
          const doctors = await doctorCollection.find().toArray();
          res.send(doctors);
        })

        // Payment intent post api
        app.post('/create-payment-intent', verifyJWT, async(req, res)=>{
          const service = req.body;
          const price = service.price;
          const amount = price*100;

          // Create a PaymentIntent with the order amount and currency
          const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: "usd",
            payment_method_types: ["card"]
          });
          res.send({
            clientSecret: paymentIntent.client_secret
          })

        })

        // POST : Add new doctor
        app.post('/doctor', verifyJWT, verifyAdmin, async(req, res)=>{
          const doctor = req.body;
          const result = await doctorCollection.insertOne(doctor);
          res.send(result);
        });

        // DELETE : delete a doctor
        app.delete('/doctor/:email',verifyJWT, verifyAdmin, async(req, res)=>{
          const email = req.params.email;
          const filter = {email : email};
          const result = await doctorCollection.deleteOne(filter);
          res.send(result);
        })

    } finally {

    }
  }
  run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Hello World! From Doctor Uncle.')
})

app.listen(port, () => {
  console.log(`Doctors Portal app listening on port ${port}`)
})