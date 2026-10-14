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


def audio_safe_chunks(chunks):
    written = False
    for chunk in chunks:
        if not chunk.delta:
            continue
        for call in chunk.delta.tool_calls:
            if call.name == "record_learning":
                try:
                    written |= json.loads(call.arguments).get("kind") == "correction"
                except (ValueError, AttributeError):
                    pass
    if not written:
        return chunks
    filtered = []
    for chunk in chunks:
        copy = chunk.model_copy(deep=True)
        if copy.delta:
            copy.delta.content = None
        if copy.usage or (copy.delta and copy.delta.tool_calls):
            filtered.append(copy)
    return filtered


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
