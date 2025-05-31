import mongoose, {
  Schema,
  InferSchemaType,
  model,
  PaginateModel,
} from 'mongoose';
import paginate from 'mongoose-paginate-v2';

const screenshotSchema = new Schema(
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

type screenshotModelType = InferSchemaType<typeof screenshotSchema>;

screenshotSchema.index({ createdAt: -1 });

screenshotSchema.plugin(paginate);

const ScreenshotModel = model<
  screenshotModelType,
  PaginateModel<screenshotModelType>
>('Screenshot', screenshotSchema);

export default ScreenshotModel;
export { screenshotModelType };
