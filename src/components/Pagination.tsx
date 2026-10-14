import type { WebhookList } from "../domain/types";

export function Pagination({
  paging,
  onPageChange,
}: {
  paging: WebhookList["paging"];
  onPageChange: (page: number) => void;
}) {
  const { pages, results } = paging;

  const handlePrevious = () => {
    onPageChange(pages.current - 1);
  };

  const handleNext = () => {
    onPageChange(pages.current + 1);
  };

  return (
    <div className="pagination">
      <span className="muted">
        {results.total === 0
          ? "0 results"
          : `${(pages.current - 1) * results.limitation + 1}–${Math.min(pages.current * results.limitation, results.total)} of ${results.total}`}
      </span>
      <nav aria-label="Pagination">
        <button
          className="secondary"
          disabled={pages.current <= 1}
          onClick={handlePrevious}
        >
          Previous
        </button>
        <span>
          Page {pages.current} of {pages.last}
        </span>
        <button
          className="secondary"
          disabled={pages.current >= pages.last}
          onClick={handleNext}
        >
          Next
        </button>
      </nav>
    </div>
  );
}
