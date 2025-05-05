import mongoose, { Schema, Document, Model } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
//import { PaginateModel } from 'mongoose-paginate-v2';

interface IYara extends Document {
  rule?: string;
  name: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const yaraSchema: Schema<IYara> = new Schema(
  {
    rule: {
      type: String,
    },
    name: {
      type: String,
      unique: true,
    },
  },
  { timestamps: true },
);

yaraSchema.plugin(mongoosePaginate);

yaraSchema.index({ updatedAt: -1 });
//yaraSchema.index({name:1});

const YaraModel: Model<IYara> = mongoose.model<IYara, mongoose.PaginateModel<IYara>>('Yara', yaraSchema);

export default YaraModel;
