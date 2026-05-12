public class Main {
    public static void main(String[] args) {
        ScoringEngine engine = new ScoringEngine();

        Transaction[] transactions = {
            new Transaction("TX001", 8000, "RU", 23, "virement"),
            new Transaction("TX002", 200,  "FR", 14, "paiement"),
            new Transaction("TX003", 1500, "NG", 3,  "virement")
        };

        System.out.println("=== REDFLAG — Moteur de Scoring Java ===\n");

        for (Transaction t : transactions) {
            int score = engine.calculerScore(t);
            String niveau = engine.getNiveauRisque(score);
            System.out.println(t);
            System.out.println("  → Score : " + score + "/100 | Niveau : " + niveau + "\n");
        }
    }
}
