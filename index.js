const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

// Database Connection : MongoDB

const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xczhe.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();
        const serviceCollection = client.db("doctors_portal").collection("services");
        const bookingCollection = client.db("doctors_portal").collection("bookings");

        /*******************************************************************************
         ****************************** API Naming Convention **************************
         * app.get('/booking') // get all bookings in this collection. or get more than one or by filter.
         * app.get('/booking/:id') // get a specific booking
         * app.post('/booking') // add a new booking
         * app.patch('/booking/:id') // update specific info a booking
         * app.put('/booking/:id') // update whole info of a booking
         * app.delete('/booking/:id') // delete a specific booking
         * 
        *******************************************************************************/

        // GET : Load all data
        app.get("/service", async(req,res) =>{
            const query = {};
            const cursor = serviceCollection.find(query);
            const services = await cursor.toArray();
            res.send(services)
        })

        // GET : filtered available services
        app.get('/available', async(req, res)=>{
          const date = req.query.date || "May 14, 2022" ;

          // step 1: get all services
          const services = await serviceCollection.find().toArray();

          // step 2: get the booking of that day
          const query = {date: date};
          const bookings = await bookingCollection.find(query).toArray();

          // step 3: for each service, find booking for that service
          services.forEach(service =>{
            const serviceBookings = bookings.filter(b => b.treatment === service.name);
            const booked = serviceBookings.map(s => s.slot);
            const available = service.slots.filter(s => !booked.includes(s));
            service.available = available;
          })

          res.send(services);
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
          return res.send({success: true, result});
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