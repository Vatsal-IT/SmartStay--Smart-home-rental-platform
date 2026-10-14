const express=require("express");
const app=express();
const cookieParser=require("cookie-parser")
const session=require("express-session")
const flash=require("connect-flash");
const { name } = require("ejs");
const path = require("path")
app.set("views", path.join(__dirname, "views"));

app.set("view engine", "ejs");

const sessionOptions={
    secret:"musupersecretstring",
    resave:false,
    saveUninitialized:true 
}

app.use(session(sessionOptions))
app.use(flash())

app.use((req,res,next)=>{
    res.locals.successmsg=req.flash("success");
    res.locals.errormsg=req.flash("failure");
    next();
})

app.get("/register",(req,res)=>{
    let {name="adam"}=req.query;
    req.session.name=name;
    if(req.session.name!="adam"){
        req.flash("success","user registered");
    }else{
        req.flash("failure","Please register")
    }
    res.redirect("/hello");
})

app.get("/hello",(req,res)=>{
    res.render("page.ejs",{name:req.session.name});
})

app.get("/test",(req,res)=>{
    res.send("test successfull");
})

app.get("/reqcount",(req,res)=>{
    if(req.session.count){
        req.session.count+=1;
    }else{
        req.session.count=1;
    }
    res.send(`you visit the site for ${req.session.count} times`)
})

app.listen(3000,()=>{ 
    console.log("app listning on 8080");
})