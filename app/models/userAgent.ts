import mongoose, {
  Schema,
  InferSchemaType,
  model,
  PaginateModel,
} from 'mongoose';
import paginate from 'mongoose-paginate-v2';

const userAgentSchema = new Schema({
  name: {
    type: String,
    trim: true,
  },
  userAgent: {
    type: String,
    trim: true,
  },
});

type userAgentModelType = InferSchemaType<typeof userAgentSchema>;

const UserAgentModel = model<
  userAgentModelType,
  PaginateModel<userAgentModelType>
>('UserAgent', userAgentSchema);

const data = [
  {
    name: 'win10-chrome',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36',
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
