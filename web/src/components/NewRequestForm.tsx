import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, MessageSquareText, LoaderCircle } from "lucide-react";
import { errorMessage } from "../lib/api";
const formSchema = z.object({
  customer_name: z.string().trim().min(1, "Enter the customer name.").max(150),
  business: z.string().max(200),
  title: z.string().max(200),
  text: z.string().max(20000, "Use up to 20,000 characters."),
});
export type NewRequestValues = z.infer<typeof formSchema>;
export function NewRequestForm({
  onCreate,
}: {
  onCreate: (data: NewRequestValues) => Promise<unknown>;
}) {
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewRequestValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { customer_name: "", business: "", title: "", text: "" },
  });
  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        setError("");
        try {
          await onCreate(values);
        } catch (e) {
          setError(errorMessage(e));
        }
      })}
      className="stacked-form"
    >
      <div className="field-pair">
        <label className="field">
          Customer name
          <input
            {...register("customer_name")}
            placeholder="e.g. Riya Sharma"
            autoFocus
          />
          {errors.customer_name && (
            <span className="field-error">{errors.customer_name.message}</span>
          )}
        </label>
        <label className="field">
          Business <span className="optional">optional</span>
          <input {...register("business")} placeholder="e.g. Studio Riya" />
        </label>
      </div>
      <label className="field">
        Job name <span className="optional">optional</span>
        <input
          {...register("title")}
          placeholder="Visiting cards for Studio Riya"
        />
      </label>
      <label className="field">
        Customer conversation
        <textarea
          {...register("text")}
          rows={6}
          placeholder="Paste the messages here, including corrections and follow-ups. You can add screenshots after creating the request."
        />
        {errors.text && (
          <span className="field-error">{errors.text.message}</span>
        )}
      </label>
      <p className="form-help">
        <MessageSquareText size={15} />
        English, Hindi and Hinglish are welcome. You’ll review the details
        before quoting.
      </p>
      {error && (
        <div role="alert" className="error-note">
          {error}
        </div>
      )}
      <div className="dialog-actions">
        <button className="button primary" disabled={isSubmitting}>
          {isSubmitting ? <LoaderCircle className="spin" size={16} /> : null}
          Create request
          <ArrowRight size={16} />
        </button>
      </div>
    </form>
  );
}
