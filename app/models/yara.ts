import mongoose, {
  Schema,
  InferSchemaType,
  model,
  PaginateModel,
} from 'mongoose';
import paginate from 'mongoose-paginate-v2';

const yaraSchema = new Schema(
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

type yaraModelType = InferSchemaType<typeof yaraSchema>;

yaraSchema.plugin(paginate);

yaraSchema.index({ updatedAt: -1 });

const YaraModel = model<yaraModelType, PaginateModel<yaraModelType>>(
  'Yara',
  yaraSchema,
);
export default YaraModel;
export { yaraModelType };
