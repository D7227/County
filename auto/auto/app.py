from flask import Flask
from dotenv import load_dotenv
load_dotenv()

from blueprints.party_routes import party_bp
from blueprints.scrape_routes import scrape_bp
from blueprints.Details import details_bp

app = Flask(__name__)

# Register Blueprints
app.register_blueprint(party_bp)
app.register_blueprint(scrape_bp)
app.register_blueprint(details_bp)

if __name__ == "__main__":
    app.run(debug=True, port=5001)
