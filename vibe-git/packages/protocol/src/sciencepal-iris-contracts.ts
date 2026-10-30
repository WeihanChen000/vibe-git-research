import type { SPResultSchema, SPResultSchemas } from "./sciencepal-pipeline.js";
const number: SPResultSchema = { type: "number" };
const text: SPResultSchema = { type: "string", minLength: 1 };
const object = (properties: Record<string, SPResultSchema>): SPResultSchema => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
const species: SPResultSchema = { type: "string", enum: ["Iris-setosa", "Iris-versicolor", "Iris-virginica"] };
const limitations: SPResultSchema = { type: "array", minItems: 1, maxItems: 10, items: text };
const shared: Record<string, SPResultSchema> = {
  synthetic: { type: "boolean", const: false }, source_sha256: { type: "string", minLength: 64, maxLength: 64 },
  measurement_unit: { type: "string", const: "cm" }, record_count: { type: "integer", const: 150 }, limitations,
};
/** No expected digest/statistical answers: calculate those from the actual source. */
export const IRIS_RESULT_SCHEMAS: SPResultSchemas = {
  data_audit: object({ ...shared, dataset: text,
    species_counts: object(Object.fromEntries(["Iris-setosa", "Iris-versicolor", "Iris-virginica"].map(s => [s, { type: "integer", const: 50 }]))),
    rows: { type: "array", minItems: 150, maxItems: 150, items: { type: "array", minItems: 5, maxItems: 5, items: [number, number, number, number, species], additionalItems: false } },
  }),
  species_summary: object({ ...shared,
    summary_rows: { type: "array", minItems: 3, maxItems: 3, items: object({ species, n: { type: "integer", const: 50 },
      sepal_length_mean: number, sepal_width_mean: number, petal_length_mean: number, petal_width_mean: number, petal_length_min: number, petal_length_max: number }) },
    petal_length_mean_order: { type: "array", minItems: 3, maxItems: 3, items: species },
    versicolor_virginica_range_overlap: { type: "boolean" }, conclusion_zh: text, citation: text,
  }),
};
