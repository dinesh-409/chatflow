import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const clean = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const Session = mongoose.connection.useDb('test').model('Session', new mongoose.Schema({}, { strict: false }));
    const Memory = mongoose.connection.useDb('test').model('Memory', new mongoose.Schema({}, { strict: false }));
    
    // Actually, let's just use the real models
    const RealSession = (await import('./src/models/Session.js')).default;
    await RealSession.deleteMany({ title: "New Chat" });
    console.log("Wiped all 'New Chat' sessions.");
    process.exit(0);
};
clean();
