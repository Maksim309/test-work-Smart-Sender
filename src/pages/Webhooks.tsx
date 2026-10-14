import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { listParameters } from "../domain/validation";
import type { WebhookList } from "../domain/types";
import { ErrorState, Loading } from "../components/Feedback";
import { WebhookTable } from "../components/WebhookTable";
import { WebhookFilters } from "../components/WebhookFilters";
import { Pagination } from "../components/Pagination";

export function Webhooks() {
  const location = useLocation();
  const [filters, setFilters] = useSearchParams();
  const { page, search } = listParameters(filters);
  const {
    data: webhooksResult,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["webhooks", page, search],
    queryFn: ({ signal }) =>
      api.request<WebhookList>(
        `/v1/webhooks?${new URLSearchParams({ page: String(page), limit: "10", search })}`,
        { protected: true, signal },
      ),
  });
  const updateSearch = useCallback(
    (search: string) => {
      setFilters(
        { page: "1", ...(search ? { search } : {}) },
        { replace: true },
      );
    },
    [setFilters],
  );
  const paging = webhooksResult?.paging;

  const handleClear = () => {
    setFilters({});
  };

  const handleRetry = () => {
    void refetch();
  };

  const handlePageChange = (page: number) => {
    setFilters({ page: String(page), ...(search ? { search } : {}) });
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">WORKSPACE / INTEGRATIONS</span>
          <h1>Webhooks</h1>
          <p className="muted">
            Manage the endpoints that keep your services connected.
          </p>
        </div>
      </div>
      <section className="card">
        <WebhookFilters
          navigationKey={location.key}
          search={search}
          total={paging?.results.total}
          onSearch={updateSearch}
          onClear={handleClear}
        />
        {isPending ? (
          <Loading />
        ) : isError ? (
          <ErrorState error={error} onRetry={handleRetry} />
        ) : webhooksResult.data.length === 0 ? (
          <div className="feedback">
            <h3>No webhooks found</h3>
            <p className="muted">Try a different name or clear your search.</p>
            {search && (
              <button className="secondary" onClick={handleClear}>
                Clear search
              </button>
            )}
          </div>
        ) : (
          <WebhookTable items={webhooksResult.data} search={location.search} />
        )}
        {paging && (
          <Pagination paging={paging} onPageChange={handlePageChange} />
        )}
      </section>
      <p className="bottom-note">
        Endpoint changes are saved securely through your workspace API.
      </p>
    </>
  );
}
