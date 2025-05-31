import mongoose, {
  Schema,
  InferSchemaType,
  model,
  PaginateModel,
} from 'mongoose';
import paginate from 'mongoose-paginate-v2';

const tagSchema = new Schema(
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

type tagModelType = InferSchemaType<typeof tagSchema>;

tagSchema.plugin(paginate);

tagSchema.index({ createdAt: -1 });
tagSchema.index({ key: 1, value: 1 }, { unique: true });

const TagModel = model<tagModelType, PaginateModel<tagModelType>>(
  'Tag',
  tagSchema,
);

export default TagModel;
export { tagModelType };
