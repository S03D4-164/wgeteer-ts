import mongoose, { Schema, Document, Model } from 'mongoose';

interface IUserAgent extends Document {
  name: string;
  userAgent: string;
}

const userAgentSchema: Schema<IUserAgent> = new Schema({
  name: {
    type: String,
    trim: true,
  },
  userAgent: {
    type: String,
    trim: true,
  },
});

const UserAgentModel: Model<IUserAgent> = mongoose.model<IUserAgent>('UserAgent', userAgentSchema);

const data = [
  {
    name: 'win10-chrome',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36',
  },
];

async function insertInitialData() {
  try {
    const count = await UserAgentModel.countDocuments();
    if (count === 0) {
      await UserAgentModel.insertMany(data);
      console.log('Initial user agent data inserted.');
    } else {
      console.log('User agent data already exists.');
    }
  } catch (err) {
    console.error('Error inserting user agent data:', err);
  }
}

insertInitialData();

export default UserAgentModel;