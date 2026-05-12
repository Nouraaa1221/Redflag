import java.sql.*;
import java.util.ArrayList;
import java.util.List;

public class OracleConnector {

    private static final String URL = "jdbc:oracle:thin:@localhost:1521:redflag";
    private static final String USER = "redflag_user";
    private static final String PASSWORD = "redflag_pass";

    private Connection connection;

    // Connexion à Oracle
    public void connect() throws SQLException {
        this.connection = DriverManager.getConnection(URL, USER, PASSWORD);
        System.out.println("Connexion Oracle établie.");
    }

    // Sauvegarder un score en base
    public void sauvegarderScore(String transactionId, int score, String niveau) throws SQLException {
        String sql = "INSERT INTO SCORES_RISQUE (TRANSACTION_ID, SCORE, NIVEAU, DATE_ANALYSE) " +
                     "VALUES (?, ?, ?, SYSDATE)";

        PreparedStatement stmt = connection.prepareStatement(sql);
        stmt.setString(1, transactionId);
        stmt.setInt(2, score);
        stmt.setString(3, niveau);
        stmt.executeUpdate();
        stmt.close();
        System.out.println("Score sauvegardé pour " + transactionId);
    }

    // Récupérer les transactions à risque élevé
    public List<String> getTransactionsCritiques() throws SQLException {
        List<String> resultats = new ArrayList<>();
        String sql = "SELECT TRANSACTION_ID, SCORE FROM SCORES_RISQUE WHERE NIVEAU = 'CRITIQUE'";

        Statement stmt = connection.createStatement();
        ResultSet rs = stmt.executeQuery(sql);

        while (rs.next()) {
            resultats.add("ID: " + rs.getString("TRANSACTION_ID") +
                         " | Score: " + rs.getInt("SCORE"));
        }

        rs.close();
        stmt.close();
        return resultats;
    }

    // Fermer la connexion
    public void disconnect() throws SQLException {
        if (connection != null && !connection.isClosed()) {
            connection.close();
            System.out.println("Connexion Oracle fermée.");
        }
    }
}
