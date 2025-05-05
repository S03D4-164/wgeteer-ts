import mongoose, { Schema, Document, Model } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
//import { PaginateModel } from 'mongoose-paginate-v2';

export interface IScreenshot extends Document {
  screenshot: string;
  md5?: string;
  createdAt?: Date;
  tag?: Record<string, any>[];
}

const screenshotSchema: Schema<IScreenshot> = new Schema(
  {
    screenshot: {
      type: String,
      required: true,
    },
    md5: {
      type: String,
      unique: true,
    },
    tag: {
      type: [Object],
    },
  },
  { timestamps: true },
);

screenshotSchema.index({ createdAt: -1 });

screenshotSchema.plugin(mongoosePaginate);

const ScreenshotModel: Model<IScreenshot> = mongoose.model<IScreenshot, mongoose.PaginateModel<IScreenshot>>('Screenshot', screenshotSchema);

export default ScreenshotModel;
