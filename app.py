from flask import Flask, render_template, request, jsonify, url_for
from werkzeug.utils import secure_filename
from database import db, Wish, Comment
from datetime import datetime
import os

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///guestbook.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'mp4', 'mov', 'avi'}

db.init_app(app)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def time_ago(dt):
    now = datetime.utcnow()
    diff = now - dt
    
    seconds = diff.total_seconds()
    
    if seconds < 60:
        return "Just now"
    elif seconds < 3600:
        minutes = int(seconds / 60)
        return f"{minutes} {'minute' if minutes == 1 else 'minutes'} ago"
    elif seconds < 86400:
        hours = int(seconds / 3600)
        return f"{hours} {'hour' if hours == 1 else 'hours'} ago"
    elif seconds < 172800:
        return "Yesterday"
    elif seconds < 604800:
        days = int(seconds / 86400)
        return f"{days} days ago"
    else:
        return dt.strftime("%B %d, %Y")

@app.route('/')
def index():
    wishes = Wish.query.order_by(Wish.created_at.desc()).all()
    wishes_data = []
    for wish in wishes:
        wishes_data.append({
            'id': wish.id,
            'name': wish.name,
            'message': wish.message,
            'photo': wish.photo,
            'created_at': time_ago(wish.created_at),
            'likes': wish.likes,
            'comments': [{
                'name': c.name,
                'message': c.message,
                'created_at': time_ago(c.created_at)
            } for c in wish.comments]
        })
    return render_template('index.html', wishes=wishes_data)

@app.route('/post-wish', methods=['POST'])
def post_wish():
    try:
        name = request.form.get('name')
        message = request.form.get('message')
        photo_file = request.files.get('photo')
        
        if not name or not message:
            return jsonify({'error': 'Name and message are required'}), 400
        
        photo_filename = None
        if photo_file and photo_file.filename and allowed_file(photo_file.filename):
            filename = secure_filename(photo_file.filename)
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            photo_filename = f"{timestamp}_{filename}"
            photo_file.save(os.path.join(app.config['UPLOAD_FOLDER'], photo_filename))
        
        new_wish = Wish(name=name, message=message, photo=photo_filename)
        db.session.add(new_wish)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'wish': {
                'id': new_wish.id,
                'name': new_wish.name,
                'message': new_wish.message,
                'photo': new_wish.photo,
                'created_at': time_ago(new_wish.created_at),
                'likes': new_wish.likes,
                'comments': []
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/like-wish/<int:wish_id>', methods=['POST'])
def like_wish(wish_id):
    try:
        wish = Wish.query.get_or_404(wish_id)
        wish.likes += 1
        db.session.commit()
        return jsonify({'success': True, 'likes': wish.likes})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/add-comment/<int:wish_id>', methods=['POST'])
def add_comment(wish_id):
    try:
        data = request.get_json()
        name = data.get('name')
        message = data.get('message')
        
        if not name or not message:
            return jsonify({'error': 'Name and message are required'}), 400
        
        wish = Wish.query.get_or_404(wish_id)
        new_comment = Comment(wish_id=wish_id, name=name, message=message)
        db.session.add(new_comment)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'comment': {
                'name': new_comment.name,
                'message': new_comment.message,
                'created_at': time_ago(new_comment.created_at)
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    with app.app_context():
        os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
        db.create_all()
    app.run(debug=True)