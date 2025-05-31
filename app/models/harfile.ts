import mongoose, {
  Schema,
  InferSchemaType,
  model,
  PaginateModel,
} from 'mongoose';
import paginate from 'mongoose-paginate-v2';

const harfileSchema = new Schema(
  {
    har: {
      type: Buffer,
      required: true,
    },
    webpage: { type: mongoose.Schema.Types.ObjectId, ref: 'Webpage' },
  },
  { timestamps: true },
);

type harfileModelType = InferSchemaType<typeof harfileSchema>;

harfileSchema.plugin(paginate);

const HarfileModel = model<harfileModelType, PaginateModel<harfileModelType>>(
  'Harfile',
  harfileSchema,
);

export default HarfileModel;
export { harfileModelType };
