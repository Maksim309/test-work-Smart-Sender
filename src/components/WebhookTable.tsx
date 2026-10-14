import { Link } from "react-router-dom";
import type { Webhook } from "../domain/types";

export function WebhookTable({
  items,
  search,
}: {
  items: Webhook[];
  search: string;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Endpoint URL</th>
            <th>Active</th>
            <th>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <strong>{item.name}</strong>
              </td>
              <td className="url-cell">{item.url}</td>
              <td>
                <span className={`badge ${item.active ? "active" : ""}`}>
                  {item.active ? "Active" : "Inactive"}
                </span>
              </td>
              <td>
                <Link
                  className="edit-link"
                  to={`/webhooks/${item.id}${search}`}
                  aria-label={`Edit ${item.name}`}
                  title={`Edit ${item.name}`}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m16 3 5 5-12 12-6 1 1-6L16 3Z" />
                    <path d="m14 5 5 5" />
                  </svg>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
