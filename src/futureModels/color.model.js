import mongoose from 'mongoose';

const colorSchema = new mongoose.Schema({
  name: { type: String, required: true }, // E.g., "Ivory", "Sand", "Caramel"
  hex: { type: String, required: true }, // E.g., "#F5C8A0" for color code
});

const Color = mongoose.model('Color', colorSchema);

export default Color;
