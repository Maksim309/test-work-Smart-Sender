import { useState, type ChangeEvent, type FormEvent } from "react";
import { ApiError, errorMessage } from "../api/client";
import { validateWebhook } from "../domain/validation";
import type { FieldErrors, WebhookInput } from "../domain/types";

export function WebhookForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: WebhookInput;
  onSave: (fields: WebhookInput) => Promise<unknown>;
  onCancel?: () => void;
}) {
  const [fields, setFields] = useState(initial);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState("");
  const [isSaved, setSaved] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const { name, url } = fields;
  const { name: nameErrors, url: urlErrors } = fieldErrors;
  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSaved(false);
    setFields({ ...fields, name: event.target.value });
  };

  const handleUrlChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSaved(false);
    setFields({ ...fields, url: event.target.value });
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();

    setSaved(false);
    setSaveError("");

    const validationErrors = validateWebhook(fields);

    setFieldErrors(validationErrors);

    if (Object.keys(validationErrors).length) {
      return;
    }

    setSaving(true);

    try {
      await onSave(fields);

      setSaved(true);
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 422 &&
        error.body.error.payload
      ) {
        setFieldErrors(error.body.error.payload);
      } else {
        setSaveError(errorMessage(error));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="edit-form" noValidate onSubmit={handleSave}>
      <label htmlFor="name">Name</label>
      <input
        id="name"
        value={name}
        disabled={isSaving}
        aria-invalid={!!nameErrors}
        aria-describedby={nameErrors ? "name-error" : undefined}
        onChange={handleNameChange}
      />
      {nameErrors && (
        <p className="field-error" id="name-error" role="alert">
          {nameErrors.join(" ")}
        </p>
      )}
      <label htmlFor="url">Endpoint URL</label>
      <input
        id="url"
        type="url"
        value={url}
        disabled={isSaving}
        aria-invalid={!!urlErrors}
        aria-describedby={urlErrors ? "url-error" : "url-help"}
        onChange={handleUrlChange}
      />
      <p className="hint" id="url-help">
        Use a full URL beginning with https:// or http://.
      </p>
      {urlErrors && (
        <p className="field-error" id="url-error" role="alert">
          {urlErrors.join(" ")}
        </p>
      )}
      {saveError && (
        <p className="field-error" role="alert">
          {saveError}
        </p>
      )}
      {isSaved && (
        <p className="success" role="status">
          Webhook saved successfully.
        </p>
      )}
      <div className="form-footer">
        <button disabled={isSaving}>
          {isSaving ? "Saving…" : "Save changes"}
        </button>
        {onCancel && (
          <button
            type="button"
            className="secondary"
            disabled={isSaving}
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
        <span className="hint">Changes apply after saving.</span>
      </div>
    </form>
  );
}
