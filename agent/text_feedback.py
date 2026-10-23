"""Keep written correction cards out of the tutor's audio."""
import json


def correction_was_shown(context) -> bool:
    for item in reversed(context.items):
        if item.type == "message" and item.role == "user":
            break
        if item.type == "function_call_output" and item.name == "record_learning":
            try:
                if json.loads(item.output).get("delivery") == "text_only":
                    return True
            except (ValueError, AttributeError):
                pass
    return False


def _contains_written_correction(chunk):
    if not chunk.delta:
        return False
    for call in chunk.delta.tool_calls:
        if call.name == "record_learning":
            try:
                arguments = json.loads(call.arguments)
                if not isinstance(arguments, dict) or arguments.get("kind") == "correction":
                    return True
            except (ValueError, TypeError):
                # Do not narrate an ambiguous/incomplete learning card.
                return True
    return False


def _without_narration(chunks):
    filtered = []
    for chunk in chunks:
        copy = chunk.model_copy(deep=True)
        if copy.delta:
            copy.delta.content = None
        if copy.usage or (copy.delta and copy.delta.tool_calls):
            filtered.append(copy)
    return filtered


def audio_safe_chunks(chunks):
    return _without_narration(chunks) if any(_contains_written_correction(c) for c in chunks) else chunks


class AudioDeliveryGate:
    """Stream safe turns; quarantine narration when a later tool could be a card.

    Completed correction calls can be handed to LiveKit immediately (without
    their narration). Nothing is re-emitted on completion or a failed stream.
    """
    def __init__(self, *, guarded: bool):
        self.guarded = guarded
        self.written = False
        self.pending = []

    def push(self, chunk):
        if not self.guarded:
            return [chunk]
        self.written = self.written or _contains_written_correction(chunk)
        self.pending.append(chunk)
        if self.written:
            chunks, self.pending = self.pending, []
            return _without_narration(chunks)
        return []

    def finish(self, *, complete=True):
        chunks, self.pending = self.pending, []
        # On a transport error we cannot know whether a correction would have
        # followed the buffered narration. Keep that narration out of audio.
        if self.written or (self.guarded and not complete):
            return _without_narration(chunks)
        return chunks


def recovery_invitation(language: str) -> str:
    return {
        "es": "Tienes la corrección en pantalla. Revísala y luego reformula tu frase en inglés sin mirar.",
        "en": "Your correction is on screen. Review it, then reformulate your sentence in English without looking.",
        "pt": "A correção está na tela. Revise e depois reformule sua frase em inglês sem olhar.",
        "fr": "La correction est à l'écran. Lisez-la, puis reformulez votre phrase en anglais sans regarder.",
        "de": "Die Korrektur steht auf dem Bildschirm. Lies sie und formuliere deinen Satz dann ohne Nachschauen auf Englisch.",
        "it": "La correzione è sullo schermo. Leggila, poi riformula la frase in inglese senza guardare.",
        "zh": "纠正在屏幕上。看完后，不看屏幕，用英语重新表达你的句子。",
        "ja": "訂正が画面に表示されています。確認してから、画面を見ずに英語で言い直してください。",
    }.get(language, "Review the correction on screen, then reformulate in English without looking.")
