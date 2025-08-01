import mongoose from 'mongoose';

const ShipSchema = new mongoose.Schema({
  user1: String,
  user2: String,
  name: { type: String, unique: true },
  supporters: [String],
});

export default mongoose.models.Ship || mongoose.model('Ship', ShipSchema);
