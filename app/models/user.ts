import mongoose, { Schema, Document, Model } from 'mongoose';
import passportLocalMongoose from 'passport-local-mongoose';

interface IUser extends Document {
  username: string;
  hash: string;
  salt: string;
  active: boolean;
  group: string[];
  admin: boolean;
  apikey: string;
}

const UserSchema: Schema<IUser> = new Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  hash: String,
  salt: String,
  active: Boolean,
  group: [String],
  admin: {
    type: Boolean,
    default: false,
  },
  apikey: String,
});

UserSchema.plugin(passportLocalMongoose);

const UserModel: Model<IUser> = mongoose.model<IUser>('User', UserSchema);

export default UserModel;