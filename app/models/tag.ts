import mongoose, { Schema, Document, Model } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
//import { PaginateModel } from 'mongoose-paginate-v2';

interface ITag extends Document {
  key: string;
  value: string;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const tagSchema: Schema<ITag> = new Schema(
  {
    key: {
      type: String,
      lowercase: true,
      trim: true,
      required: true,
    },
    value: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
  },
  { timestamps: true },
);

tagSchema.index({ createdAt: -1 });
tagSchema.index({ key: 1, value: 1 }, { unique: true });

tagSchema.plugin(mongoosePaginate);

const TagModel: Model<ITag> = mongoose.model<ITag, mongoose.PaginateModel<ITag>>('Tag', tagSchema);

export default TagModel;