const mongoose=require("mongoose");
mongoose.connect("mongodb+srv://AbinashAuth:5zPNM4fwlUzewyE9@cluster0.s3jxrn1.mongodb.net/RESUME-Builder")
.then(()=>{
    console.log("Connected to MongoDB");
})
.catch((err)=>{
    console.log(err);
})