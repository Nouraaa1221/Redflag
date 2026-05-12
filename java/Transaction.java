public class Transaction {
    private String id;
    private double montant;
    private String pays;
    private int heure;
    private String type;

    public Transaction(String id, double montant, String pays, int heure, String type) {
        this.id = id;
        this.montant = montant;
        this.pays = pays;
        this.heure = heure;
        this.type = type;
    }

    public String getId() { return id; }
    public double getMontant() { return montant; }
    public String getPays() { return pays; }
    public int getHeure() { return heure; }
    public String getType() { return type; }

    @Override
    public String toString() {
        return "Transaction{id='" + id + "', montant=" + montant +
               ", pays='" + pays + "', heure=" + heure + "}";
    }
}
