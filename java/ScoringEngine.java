import java.util.Arrays;
import java.util.List;

public class ScoringEngine {

    
    private double seuilMontantEleve = 5000.0;
    private double seuilVirement = 1000.0;
    private int heureDebutNuit = 22;
    private int heureFinNuit = 6;
    private List<String> paysRisque = Arrays.asList("RU", "CN", "NG", "KP", "IR");

    public int calculerScore(Transaction t) {
        int score = 0;

        if (t.getMontant() > seuilMontantEleve) score += 35;
        if (t.getHeure() >= heureDebutNuit || t.getHeure() < heureFinNuit) score += 25;
        if (paysRisque.contains(t.getPays())) score += 30;
        if (t.getType().equals("virement") && t.getMontant() > seuilVirement) score += 10;

        return Math.min(score, 100);
    }

    public String getNiveauRisque(int score) {
        if (score >= 70) return "CRITIQUE";
        if (score >= 40) return "WARNING";
        return "NORMAL";
    }

    public void setSeuilMontantEleve(double seuil) { this.seuilMontantEleve = seuil; }
    public void setSeuilVirement(double seuil) { this.seuilVirement = seuil; }
    public void setPaysRisque(List<String> pays) { this.paysRisque = pays; }
}
