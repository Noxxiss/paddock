<script>
  import { onMount } from 'svelte';

  let { taskId, onback } = $props();

  let task = $state(null);
  let comments = $state([]);
  let loading = $state(true);
  let error = $state('');
  let commentBody = $state('');
  let posting = $state(false);
  let postError = $state('');

  function getToken() {
    return localStorage.getItem('token');
  }

  function relativeTime(dateStr) {
    const now = Date.now();
    const then = new Date(dateStr + 'Z').getTime();
    const diffMs = now - then;
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return new Date(dateStr).toLocaleDateString();
  }

  async function loadTask() {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        task = (await res.json()).task;
      } else if (res.status === 401) {
        onback();
      } else {
        error = 'Task not found';
      }
    } catch {
      error = 'Network error';
    }
  }

  async function loadComments() {
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        comments = (await res.json()).comments;
      }
    } catch {
      error = 'Failed to load comments';
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!commentBody.trim()) return;

    posting = true;
    postError = '';
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ body: commentBody.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        comments = [...comments, data.comment];
        commentBody = '';
      } else {
        const data = await res.json();
        postError = data.error || 'Failed to post comment';
      }
    } catch {
      postError = 'Network error';
    } finally {
      posting = false;
    }
  }

  const priorityLabel = {
    high: 'High',
    medium: 'Med',
    low: 'Low',
  };

  function locationLabel(task) {
    if (task.location_type === 'paddock' && task.paddock_name) {
      return `Paddock: ${task.paddock_name}`;
    }
    if (task.location_type === 'drawing') {
      return 'Drawing';
    }
    return '';
  }

  onMount(() => {
    Promise.all([loadTask(), loadComments()]).then(() => {
      loading = false;
    });
  });
</script>

<div class="task-detail">
  <div class="header">
    <button class="back-btn" onclick={onback}>&larr; Back</button>
    <h1>{task?.title || 'Task'}</h1>
  </div>

  {#if loading}
    <div class="loading-overlay">
      <p>Loading...</p>
    </div>
  {/if}

  {#if error}
    <div class="error-bar">{error}</div>
  {/if}

  {#if !loading && task}
    <div class="detail-body">
      <div class="detail-card">
        <div class="detail-row">
          <span class="detail-label">Status</span>
          <span class="status-badge">{task.status}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Priority</span>
          <span class="priority-badge priority-{task.priority}">{priorityLabel[task.priority] || task.priority}</span>
        </div>
        {#if task.assigned_to_name}
          <div class="detail-row">
            <span class="detail-label">Assigned to</span>
            <span>{task.assigned_to_name}</span>
          </div>
        {/if}
        {#if locationLabel(task)}
          <div class="detail-row">
            <span class="detail-label">Location</span>
            <span>{locationLabel(task)}</span>
          </div>
        {/if}
        <div class="detail-row">
          <span class="detail-label">Created</span>
          <span>{relativeTime(task.created_at)}</span>
        </div>
        {#if task.status === 'done'}
          <div class="detail-row">
            <span class="detail-label">Completed</span>
            <span>{relativeTime(task.completed_at)}{#if task.completed_by_name} by {task.completed_by_name}{/if}</span>
          </div>
        {/if}
      </div>

      <div class="comments-section">
        <h2>Comments ({comments.length})</h2>

        <div class="comment-list">
          {#if comments.length === 0}
            <p class="empty-comments">No comments yet.</p>
          {/if}
          {#each comments as comment (comment.id)}
            <div class="comment">
              <div class="comment-header">
                <span class="comment-author">{comment.author_name}</span>
                <span class="comment-time">{relativeTime(comment.created_at)}</span>
              </div>
              <div class="comment-body">{comment.body}</div>
            </div>
          {/each}
        </div>

        <form class="comment-form" onsubmit={handleSubmit}>
          {#if postError}
            <p class="post-error">{postError}</p>
          {/if}
          <textarea
            bind:value={commentBody}
            placeholder="Add a comment..."
            rows="3"
            disabled={posting}
          ></textarea>
          <button type="submit" disabled={posting || !commentBody.trim()}>
            {posting ? 'Posting...' : 'Post comment'}
          </button>
        </form>
      </div>
    </div>
  {/if}
</div>

<style>
  .task-detail {
    max-width: 600px;
    margin: 0 auto;
    padding: 0;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: #2c3e50;
    color: white;
    position: sticky;
    top: 0;
    z-index: 1000;
  }

  .header h1 {
    margin: 0;
    font-size: 1.1rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .back-btn {
    padding: 4px 10px;
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.3);
    border-radius: 4px;
    color: white;
    font-size: 0.85rem;
    cursor: pointer;
    flex-shrink: 0;
  }

  .back-btn:hover {
    background: rgba(255,255,255,0.2);
  }

  .loading-overlay {
    padding: 40px;
    text-align: center;
    color: #7f8c8d;
  }

  .error-bar {
    background: #e74c3c;
    color: white;
    padding: 8px 12px;
    text-align: center;
    font-size: 0.85rem;
  }

  .detail-body {
    padding: 12px;
  }

  .detail-card {
    background: white;
    border-radius: 6px;
    padding: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    margin-bottom: 16px;
  }

  .detail-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
    font-size: 0.9rem;
  }

  .detail-row + .detail-row {
    border-top: 1px solid #f0f0f0;
  }

  .detail-label {
    color: #95a5a6;
    font-size: 0.8rem;
    width: 80px;
    flex-shrink: 0;
  }

  .status-badge {
    font-size: 0.75rem;
    background: #eafaf1;
    color: #27ae60;
    padding: 2px 8px;
    border-radius: 3px;
    text-transform: uppercase;
    font-weight: 600;
  }

  .priority-badge {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 3px;
    text-transform: uppercase;
  }

  .priority-high {
    background: #fde8e8;
    color: #e74c3c;
  }

  .priority-medium {
    background: #fef5e7;
    color: #f39c12;
  }

  .priority-low {
    background: #f2f3f4;
    color: #95a5a6;
  }

  .comments-section {
    background: white;
    border-radius: 6px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    overflow: hidden;
  }

  .comments-section h2 {
    margin: 0;
    padding: 12px;
    font-size: 0.95rem;
    color: #2c3e50;
    border-bottom: 1px solid #f0f0f0;
  }

  .comment-list {
    padding: 0;
  }

  .empty-comments {
    padding: 20px 12px;
    text-align: center;
    color: #95a5a6;
    font-size: 0.85rem;
    margin: 0;
  }

  .comment {
    padding: 10px 12px;
  }

  .comment + .comment {
    border-top: 1px solid #f5f5f5;
  }

  .comment-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .comment-author {
    font-weight: 600;
    font-size: 0.85rem;
    color: #2c3e50;
  }

  .comment-time {
    font-size: 0.75rem;
    color: #95a5a6;
  }

  .comment-body {
    font-size: 0.9rem;
    color: #555;
    line-height: 1.4;
    white-space: pre-wrap;
  }

  .comment-form {
    padding: 12px;
    border-top: 1px solid #f0f0f0;
  }

  .post-error {
    color: #e74c3c;
    font-size: 0.8rem;
    margin: 0 0 8px;
  }

  .comment-form textarea {
    width: 100%;
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.9rem;
    font-family: inherit;
    resize: vertical;
    box-sizing: border-box;
  }

  .comment-form textarea:focus {
    outline: none;
    border-color: #4a90d9;
  }

  .comment-form button {
    margin-top: 8px;
    padding: 6px 14px;
    background: #4a90d9;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 0.85rem;
    cursor: pointer;
  }

  .comment-form button:hover {
    background: #357abd;
  }

  .comment-form button:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
