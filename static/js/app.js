// Load wishes on page load
document.addEventListener('DOMContentLoaded', loadWishes);

async function loadWishes() {
    const container = document.getElementById('wishesContainer');
    const loadingState = document.getElementById('loadingState');

    try {
        loadingState.style.display = 'block';
        container.innerHTML = '';

        const response = await fetch('/api/wishes');
        const data = await response.json();

        loadingState.style.display = 'none';

        if (data.wishes && data.wishes.length > 0) {
            data.wishes.forEach((wish, index) => {
                const wishCard = createWishCard(wish);
                container.insertAdjacentHTML('beforeend', wishCard);
            });
        } else {
            container.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;">No wishes yet. Be the first to share your wish!</div>';
        }
    } catch (error) {
        console.error('Error loading wishes:', error);
        loadingState.style.display = 'none';
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;">Failed to load wishes. Please refresh the page.</div>';
    }
}

// Open Write Wish Modal
function openWishModal() {
    document.getElementById('wishModal').classList.add('active');
}

// Close Write Wish Modal
function closeWishModal() {
    document.getElementById('wishModal').classList.remove('active');
    document.getElementById('wishForm').reset();
    document.getElementById('fileName').textContent = '';
}

// Show selected file name
document.getElementById('photoInput').addEventListener('change', function(e) {
    const fileName = e.target.files[0]?.name || '';
    document.getElementById('fileName').textContent = fileName ? `Selected: ${fileName}` : '';
});

// Submit Wish Form
document.getElementById('wishForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const formData = new FormData(this);
    const submitBtn = this.querySelector('.submit-btn');
    submitBtn.textContent = 'Posting...';
    submitBtn.disabled = true;

    try {
        const response = await fetch('/api/wishes', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            // Create new wish card
            const wishCard = createWishCard(data.wish);
            const container = document.getElementById('wishesContainer');

            // Remove empty state message if present
            const emptyState = container.querySelector('div[style*="text-align: center"]');
            if (emptyState) {
                emptyState.remove();
            }

            container.insertAdjacentHTML('afterbegin', wishCard);

            // Close modal and reset form
            closeWishModal();

            // Show success message
            alert('Your wish has been posted! 🎉');
        } else {
            alert('Error: ' + (data.error || 'Failed to post wish'));
        }
    } catch (error) {
        alert('Error posting wish: ' + error.message);
    } finally {
        submitBtn.textContent = 'Post My Wish';
        submitBtn.disabled = false;
    }
});

// Create Wish Card HTML
function createWishCard(wish) {
    // Extract the numeric part from the wish ID for display
    const wishIdForDisplay = wish.id.replace('wish-', '');

    let mediaHtml = '';
    if (wish.photo) {
        // Check if it's a base64 data URL
        if (wish.photo.startsWith('data:')) {
            const isVideo = wish.photo.startsWith('data:video');
            if (isVideo) {
                mediaHtml = `<video class="wish-media" controls>
                    <source src="${wish.photo}" type="video/mp4">
                </video>`;
            } else {
                mediaHtml = `<img src="${wish.photo}" alt="Wish photo" class="wish-media">`;
            }
        } else {
            // Legacy file path handling
            const isVideo = wish.photo.match(/\.(mp4|mov|avi)$/i);
            if (isVideo) {
                mediaHtml = `<video class="wish-media" controls>
                    <source src="/static/uploads/${wish.photo}" type="video/mp4">
                </video>`;
            } else {
                mediaHtml = `<img src="/static/uploads/${wish.photo}" alt="Wish photo" class="wish-media">`;
            }
        }
    }

    const commentsHtml = (wish.comments || []).map(comment => `
        <div class="comment">
            <strong>${escapeHtml(comment.name)}</strong>
            <p>${escapeHtml(comment.message)}</p>
            <span class="comment-time">${comment.created_at_display || comment.created_at}</span>
        </div>
    `).join('');

    return `
        <div class="wish-card" data-wish-id="${wishIdForDisplay}">
            ${mediaHtml}
            <div class="wish-content">
                <h3 class="wish-author">${escapeHtml(wish.name)}</h3>
                <p class="wish-message">${escapeHtml(wish.message)}</p>
                <p class="wish-time">⏰ ${wish.created_at_display || wish.created_at}</p>
            </div>
            <div class="wish-actions">
                <button class="like-btn" onclick="likeWish('${wishIdForDisplay}')">
                    ❤️ <span class="like-count">${wish.likes}</span>
                </button>
                <button class="comment-btn" onclick="toggleComments('${wishIdForDisplay}')">
                    💬 <span class="comment-count">${(wish.comments || []).length}</span>
                </button>
            </div>
            <div class="comments-section" id="comments-${wishIdForDisplay}" style="display: none;">
                <div class="comments-list">${commentsHtml}</div>
                <div class="add-comment">
                    <input type="text" placeholder="Your name" class="comment-name-input" id="comment-name-${wishIdForDisplay}">
                    <textarea placeholder="Add a comment..." class="comment-input" id="comment-text-${wishIdForDisplay}"></textarea>
                    <button onclick="addComment('${wishIdForDisplay}')">Post Comment</button>
                </div>
            </div>
        </div>
    `;
}

// Like a Wish
async function likeWish(wishId) {
    try {
        const response = await fetch(`/api/wishes/${wishId}/like`, {
            method: 'POST'
        });

        const data = await response.json();

        if (data.success) {
            const wishCard = document.querySelector(`[data-wish-id="${wishId}"]`);
            const likeCount = wishCard.querySelector('.like-count');
            likeCount.textContent = data.likes;

            // Add animation
            const likeBtn = wishCard.querySelector('.like-btn');
            likeBtn.style.transform = 'scale(1.2)';
            setTimeout(() => {
                likeBtn.style.transform = 'scale(1)';
            }, 200);
        }
    } catch (error) {
        console.error('Error liking wish:', error);
    }
}

// Toggle Comments Section
function toggleComments(wishId) {
    const commentsSection = document.getElementById(`comments-${wishId}`);
    if (commentsSection.style.display === 'none') {
        commentsSection.style.display = 'block';
    } else {
        commentsSection.style.display = 'none';
    }
}

// Add Comment
async function addComment(wishId) {
    const nameInput = document.getElementById(`comment-name-${wishId}`);
    const textInput = document.getElementById(`comment-text-${wishId}`);

    const name = nameInput.value.trim();
    const message = textInput.value.trim();

    if (!name || !message) {
        alert('Please enter your name and comment');
        return;
    }

    try {
        const response = await fetch(`/api/wishes/${wishId}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, message })
        });

        const data = await response.json();

        if (data.success) {
            // Add comment to UI
            const wishCard = document.querySelector(`[data-wish-id="${wishId}"]`);
            const commentsList = wishCard.querySelector('.comments-list');

            const commentHtml = `
                <div class="comment">
                    <strong>${escapeHtml(data.comment.name)}</strong>
                    <p>${escapeHtml(data.comment.message)}</p>
                    <span class="comment-time">${data.comment.created_at_display}</span>
                </div>
            `;

            commentsList.insertAdjacentHTML('beforeend', commentHtml);

            // Update comment count
            const commentCount = wishCard.querySelector('.comment-count');
            commentCount.textContent = parseInt(commentCount.textContent) + 1;

            // Clear inputs
            nameInput.value = '';
            textInput.value = '';
        }
    } catch (error) {
        alert('Error posting comment: ' + error.message);
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Close modal when clicking outside
document.getElementById('wishModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeWishModal();
    }
});
