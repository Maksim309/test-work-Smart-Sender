import { useEffect, useState, type ChangeEvent } from "react";

export function WebhookFilters({
  search,
  navigationKey,
  total,
  onSearch,
  onClear,
}: {
  search: string;
  navigationKey: string;
  total?: number;
  onSearch: (search: string) => void;
  onClear: () => void;
}) {
  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    setSearchInput(search);
  }, [search, navigationKey]);

  useEffect(() => {
    if (searchInput === search) {
      return;
    }

    const searchTimer = window.setTimeout(() => onSearch(searchInput), 300);

    return () => window.clearTimeout(searchTimer);
  }, [searchInput, search, onSearch]);

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchInput(event.target.value);
  };

  const handleClear = () => {
    setSearchInput("");
    onClear();
  };

  return (
    <div className="table-toolbar">
      <div>
        <h2>Your endpoints</h2>
        <span className="muted">
          {total === undefined ? "Endpoint directory" : `${total} webhooks`}
        </span>
      </div>
      <div className="table-filters">
        <div className="search-box">
          <label htmlFor="search">Search by name</label>
          <input
            id="search"
            type="search"
            placeholder="Search webhooks…"
            value={searchInput}
            onChange={handleSearchChange}
          />
        </div>
        <button className="clear-filters" onClick={handleClear}>
          Clear all filters
        </button>
      </div>
    </div>
  );
}
