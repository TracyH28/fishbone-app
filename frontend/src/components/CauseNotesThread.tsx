import { useState, FormEvent, useEffect, useRef } from "react";
import { MessageCircle, Send } from "lucide-react";

export interface Note {
  id: number;
  cause_id: number;
  participant_name: string;
  content: string;
  created_at: string;
}

interface Props {
  causeId: number;
  notes: Note[];
  /** If provided, shows an input so this user can add notes */
  myName?: string;
  onAdd?: (causeId: number, content: string) => Promise<void>;
  /** Start the thread open automatically */
  defaultOpen?: boolean;
}

export default function CauseNotesThread({ causeId, notes, myName, onAdd, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const causeNotes = notes.filter(n => n.cause_id === causeId);

  // Scroll to bottom when new notes arrive while open
  useEffect(() => {
    if (open && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [causeNotes.length, open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !onAdd) return;
    setSubmitting(true);
    try {
      await onAdd(causeId, draft.trim());
      setDraft("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 text-xs transition-colors ${
          causeNotes.length > 0 ? "text-siemens-teal font-medium" : "text-gray-400 hover:text-siemens-teal"
        }`}
      >
        <MessageCircle className="w-3.5 h-3.5" />
        {causeNotes.length > 0
          ? `${causeNotes.length} note${causeNotes.length !== 1 ? "s" : ""}`
          : myName ? "Add a note" : "No notes"}
      </button>

      {open && (
        <div className="mt-2 pl-3 border-l-2 border-siemens-teal-100 space-y-2.5">
          {causeNotes.length === 0 && (
            <p className="text-xs text-gray-400 italic">
              {myName ? "No notes yet — be the first" : "No notes yet"}
            </p>
          )}
          {causeNotes.map(note => (
            <div key={note.id} className="text-xs">
              <div className="flex items-baseline gap-1.5">
                <span className="font-semibold text-gray-700">{note.participant_name}</span>
                <span className="text-gray-400">
                  {new Date(note.created_at).toLocaleTimeString("en-GB", {
                    hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="text-gray-600 mt-0.5 leading-relaxed">{note.content}</p>
            </div>
          ))}
          <div ref={bottomRef} />
          {myName && onAdd && (
            <form onSubmit={handleSubmit} className="flex gap-2 pt-1">
              <input
                className="input text-xs flex-1 py-1.5"
                placeholder={`Note as ${myName}…`}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                disabled={submitting}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) handleSubmit(e as unknown as FormEvent); }}
              />
              <button
                type="submit"
                disabled={submitting || !draft.trim()}
                className="btn-secondary btn-sm p-1.5 flex-shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
