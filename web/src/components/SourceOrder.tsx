import { useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import type { RequestRecord } from "../lib/types";
import { Modal, ErrorNote } from "./ui";
import { errorMessage } from "../lib/api";

export function SourceOrder({
  record,
  onSave,
}: {
  record: RequestRecord;
  onSave: (ids: string[]) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [ids, setIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function move(index: number, direction: number) {
    setIds((current) => {
      const next = [...current];
      [next[index], next[index + direction]] = [
        next[index + direction],
        next[index],
      ];
      return next;
    });
  }
  return (
    <>
      <button
        className="text-button"
        disabled={record.sources.length < 2}
        onClick={() => {
          setIds(record.sources.map((s) => s.id));
          setError("");
          setOpen(true);
        }}
      >
        Arrange sources
      </button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Keep the conversation in order."
        description="The model reads sources from top to bottom. Changing the order clears field confirmations so corrections can be reviewed again."
      >
        <ol className="source-order-list">
          {ids.map((id, index) => {
            const source = record.sources.find((s) => s.id === id)!;
            return (
              <li key={id}>
                <span>
                  {source.kind === "image"
                    ? "Screenshot"
                    : source.text.slice(0, 100)}
                </span>
                <button
                  className="icon-button"
                  aria-label={`Move source ${index + 1} earlier`}
                  disabled={index === 0 || busy}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`Move source ${index + 1} later`}
                  disabled={index === ids.length - 1 || busy}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown size={16} />
                </button>
              </li>
            );
          })}
        </ol>
        {error && <ErrorNote message={error} />}
        <div className="dialog-actions">
          <button
            className="button primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onSave(ids);
                setOpen(false);
              } catch (e) {
                setError(errorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Save source order
          </button>
        </div>
      </Modal>
    </>
  );
}
