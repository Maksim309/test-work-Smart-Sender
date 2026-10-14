import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { api, queryClient } from "../api";
import type { Webhook, WebhookInput } from "../domain/types";
import { WebhookForm } from "../components/WebhookForm";
import { ErrorState, Loading } from "../components/Feedback";

export function EditWebhook() {
  const { id } = useParams();
  const { search } = useLocation();
  const navigate = useNavigate();
  const {
    data: webhook,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["webhook", id],
    queryFn: ({ signal }) =>
      api.request<Webhook>(`/v1/webhooks/${id}`, { protected: true, signal }),
  });
  const saveWebhook = useMutation({
    mutationFn: (body: WebhookInput) =>
      api.request<Webhook>(`/v1/webhooks/${id}`, {
        method: "PUT",
        body,
        protected: true,
      }),
    onSuccess: async (item) => {
      queryClient.setQueryData(["webhook", id], item);

      await queryClient.invalidateQueries({ queryKey: ["webhooks"] });
    },
  });

  const handleRetry = () => {
    void refetch();
  };

  const handleCancel = () => {
    navigate(`/webhooks${search}`);
  };

  return (
    <>
      <Link className="back-link" to={`/webhooks${search}`}>
        ← Back to webhooks
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ENDPOINT SETTINGS</span>
          <h1>Edit webhook</h1>
          <p className="muted">
            Update the name and destination for this endpoint.
          </p>
        </div>
      </div>
      <section className="card edit-card">
        {isPending ? (
          <Loading />
        ) : isError ? (
          <ErrorState error={error} onRetry={handleRetry} />
        ) : (
          <>
            <div className="edit-card-heading">
              <h2>Endpoint details</h2>
              <span className={`badge ${webhook.active ? "active" : ""}`}>
                {webhook.active ? "Active" : "Inactive"}
              </span>
            </div>
            <WebhookForm
              key={id}
              initial={webhook}
              onSave={saveWebhook.mutateAsync}
              onCancel={handleCancel}
            />
          </>
        )}
      </section>
    </>
  );
}
