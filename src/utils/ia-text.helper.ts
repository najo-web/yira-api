// ============================================================
// YIRA — src/utils/ia-text.helper.ts
// Extrait le texte pur d'une réponse IA (JSON ou texte brut)
// ============================================================

/**
 * Extrait le texte lisible d'une réponse IA.
 * Gère : texte pur, JSON avec rapport_personnalise.contenu, etc.
 */
export function extraireTexteIA(raw: string | undefined, fallback = ''): string {
  if (!raw) return fallback;

  // Nettoyer les backticks markdown
  const cleaned = raw.replace(/```json|```/g, '').trim();

  // Essayer de parser comme JSON
  try {
    const parsed = JSON.parse(cleaned);
    const rp = parsed?.rapport_personnalise;
    if (rp) {
      return (
        rp.contenu ??
        rp.contenu_principal ??
        rp.contenu_personnalise ??
        rp.valorisation ??
        rp.texte ??
        JSON.stringify(rp)
      );
    }
    // JSON sans rapport_personnalise — retourner le champ texte principal
    return (
      parsed?.texte ??
      parsed?.contenu ??
      parsed?.message ??
      parsed?.rapport ??
      cleaned
    );
  } catch {
    // Déjà du texte pur
    return cleaned;
  }
}
