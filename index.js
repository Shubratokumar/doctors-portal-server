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
        console.log("database connected")
        const serviceCollection = client.db("doctors_portal").collection("services");

        // GET : Load all data
        app.get("/service", async(req,res) =>{
            const query = {};
            const cursor = serviceCollection.find(query);
            const services = await cursor.toArray();
            res.send(services)
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