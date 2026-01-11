import React, { useState, useEffect } from 'react';
import { Heart, MessageCircle, Send, Home, Search, PlusSquare, User, X, Video, ArrowLeft, LogOut } from 'lucide-react';
import './Social.css';
import { auth, db, storage } from './firebase';
import { disableNetwork } from 'firebase/firestore';
import { deleteDoc } from 'firebase/firestore';


import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';

import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  setDoc,
  getDoc
} from 'firebase/firestore';

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const SocialMediaApp = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [activeView, setActiveView] = useState('login');
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newPost, setNewPost] = useState({ text: '', mediaUrl: '', mediaType: null, mediaFile: null });
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [messages, setMessages] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [loginForm, setLoginForm] = useState({ email: '', password: '', username: '', name: '' });
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const[bio , setbio] = useState("No bio Yet")
  // Optional: disable network (offline mode)
  useEffect(() => {
    const goOffline = async () => {
      try {
        // await disableNetwork(db); // Uncomment only if testing offline
        // console.log('Firestore offline mode enabled');
      } catch (err) {
        console.error('Failed to disable network:', err);
      }
    };
    goOffline();
  }, []);

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCurrentUser(null);
        setActiveView('login');
        return;
      }

      try {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
          const newUser = {
            uid: user.uid,
            email: user.email,
            username: user.email.split('@')[0],
            name: 'New User',
            followers: [],
            following: [],
            createdAt: new Date().toISOString()
          };
          await setDoc(userRef, newUser);
          setCurrentUser(newUser);
        } else {
          setCurrentUser({ id: user.uid, ...snap.data() });
        }

        setActiveView('home');
      } catch (err) {
        console.error('Firestore read failed:', err);
      }
    });

    return () => unsubscribe();
  }, []);

  // Real-time posts listener
  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPosts(postsData);
    }, (error) => console.error('Error fetching posts:', error));

    return () => unsubscribe();
  }, []);

  // Real-time users listener
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersData);
    }, (error) => console.error('Error fetching users:', error));

    return () => unsubscribe();
  }, []);

  //Follow/Following
  useEffect(() => {
  if (!auth.currentUser) return;

  const userRef = doc(db, 'users', auth.currentUser.uid);
  const unsub = onSnapshot(userRef, (snap) => {
    if (snap.exists()) {
      setCurrentUser({ id: snap.id, ...snap.data() });
    }
  });

  return () => unsub();
}, [auth.currentUser]);


  // Real-time messages listener
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'messages'), orderBy('timestamp', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesData = snapshot.docs.map(doc => doc.data())
        .filter(msg => msg.senderId === currentUser.id || msg.receiverId === currentUser.id)
        .map((msg, idx) => ({ id: msg.id || idx.toString(), ...msg }));
      setMessages(messagesData);
    }, (error) => console.error('Error fetching messages:', error));

    return () => unsubscribe();
  }, [currentUser]);

  // Authentication
  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignup) {
        if (users.find(u => u.username === loginForm.username)) {
          alert('Username already taken.');
          setLoading(false);
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, loginForm.email, loginForm.password);
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          uid: userCredential.user.uid,
          email: loginForm.email,
          username: loginForm.username,
          name: loginForm.name,
          bio: '',
          avatar: loginForm.name.split(' ').map(n => n[0]).join('').toUpperCase(),
          createdAt: new Date().toISOString()
        });

        alert('Account created successfully!');
      } else {
        await signInWithEmailAndPassword(auth, loginForm.email, loginForm.password);
      }
    } catch (error) {
      console.error('Auth error:', error);
      alert(error.message);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // File upload
const handleFileUpload = (e, type) => {
  if (!currentUser) return alert('Login first!');

  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) return alert('File size must be <10MB');

  const reader = new FileReader();
  reader.onloadend = () => {
    setNewPost({
      ...newPost,
      mediaUrl: reader.result,
      mediaType: type,
      mediaFile: file
    });
  };
  reader.readAsDataURL(file);
};


  // Create Post
  const createPost = async () => {
    if (!newPost.text && !newPost.mediaUrl) return;
    setLoading(true);
    try {
      let mediaUrl = '';
      if (newPost.mediaFile) {
        const storageRef = ref(storage, `posts/${currentUser.id}/${Date.now()}_${newPost.mediaFile.name}`);
        const snapshot = await uploadBytes(storageRef, newPost.mediaFile);
        mediaUrl = await getDownloadURL(snapshot.ref);
      }

      await addDoc(collection(db, 'posts'), {
        userId: currentUser.id,
        text: newPost.text,
        mediaUrl,
        mediaType: newPost.mediaType,
        likes: [],
        comments: [],
        timestamp: new Date().toISOString()
      });

      setNewPost({ text: '', mediaUrl: '', mediaType: null, mediaFile: null });
      setShowCreatePost(false);
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Failed to create post.');
    }
    setLoading(false);
  };

  const toggleLike = async (postId, currentLikes) => {
    if (!currentUser) return;
    try {
      const postRef = doc(db, 'posts', postId);
      if (currentLikes.includes(currentUser.id)) {
        await updateDoc(postRef, { likes: arrayRemove(currentUser.id) });
      } else {
        await updateDoc(postRef, { likes: arrayUnion(currentUser.id) });
      }
    } catch (err) { console.error(err); }
  };

  //Follow/Following
  const toggleFollow = async (targetUser) => {
  if (!currentUser || currentUser.id === targetUser.id) return;

  const currentUserRef = doc(db, 'users', currentUser.id);
  const targetUserRef = doc(db, 'users', targetUser.id);

  const isFollowing = currentUser.following?.includes(targetUser.id);

  try {
    if (isFollowing) {
      await updateDoc(currentUserRef, {
        following: arrayRemove(targetUser.id)
      });
      await updateDoc(targetUserRef, {
        followers: arrayRemove(currentUser.id)
      });
    } else {
      await updateDoc(currentUserRef, {
        following: arrayUnion(targetUser.id)
      });
      await updateDoc(targetUserRef, {
        followers: arrayUnion(currentUser.id)
      });
    }
  } catch (err) {
    console.error('Follow error:', err);
  }
};


//Comments
  const addComment = async (postId, text) => {
    if (!text.trim() || !currentUser) return;
    try {
      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, {
        comments: arrayUnion({
          id: Date.now().toString(),
          userId: currentUser.id,
          text,
          timestamp: new Date().toISOString()
        })
      });
    } catch (err) { console.error(err); }
  };


  const deletePost = async (postId) => {
  if (!currentUser) return;
  const postRef = doc(db, 'posts', postId);

  try {
    // Optional: check if currentUser owns the post
    const postSnap = await getDoc(postRef);
    if (!postSnap.exists()) return;
    if (postSnap.data().userId !== currentUser.id) {
      alert("You can't delete someone else's post.");
      return;
    }

    await deleteDoc(postRef);
  } catch (err) {
    console.error('Error deleting post:', err);
    alert('Failed to delete post.');
  }
};


  const sendMessage = async () => {
    if (!newMessage.trim() || !activeChat || !currentUser) return;
    try {
      await addDoc(collection(db, 'messages'), {
        senderId: currentUser.id,
        receiverId: activeChat.id,
        text: newMessage,
        timestamp: new Date().toISOString(),
        read: false
      });
      setNewMessage('');
    } catch (err) { console.error(err); }
  };

  const getUserById = (userId) => users.find(u => u.id === userId) || null;

 const filteredUsers = users.filter(u =>
  u.id !== currentUser?.id &&
  (
    (u.username && u.username.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase()))
  )
);


  const userPosts = selectedProfile
    ? posts.filter(p => p.userId === selectedProfile.id)
    : posts;

  const chatMessages = messages.filter(m =>
    (m.senderId === currentUser?.id && m.receiverId === activeChat?.id) ||
    (m.senderId === activeChat?.id && m.receiverId === currentUser?.id)
  );

  // ---------- Render ----------
  if (activeView === 'login') {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <h1 className="app-title">Pulse</h1>
            <p className="app-subtitle">Connect with friends and the world</p>
          </div>

          <form onSubmit={handleAuth} className="auth-form">
            {isSignup && (
              <>
                <input
                  type="text"
                  placeholder="Full Name"
                  className="form-input"
                  value={loginForm.name}
                  onChange={(e) => setLoginForm({ ...loginForm, name: e.target.value })}
                  required
                />
                <input
                  type="text"
                  placeholder="Username"
                  className="form-input"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                  required
                />
              </>
            )}
            <input
              type="email"
              placeholder="Email"
              className="form-input"
              value={loginForm.email}
              onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
              required
            />
            <input
              type="password"
              placeholder="Password"
              className="form-input"
              value={loginForm.password}
              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              required
              minLength="6"
            />
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Loading...' : (isSignup ? 'Sign Up' : 'Log In')}
            </button>
          </form>

          <div className="toggle-auth">
            <button onClick={() => setIsSignup(!isSignup)}>
              {isSignup ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
            </button>
          </div>

          <div className="demo-info">
            <p>🔥 Real-time Social Media App with Firebase</p>
            <ol>
              <li>Replace Firebase config with your credentials</li>
              <li>Enable Authentication, Firestore & Storage in Firebase Console</li>
              <li>Create an account to get started</li>
              <li>Share posts, upload images/videos in real-time!</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  // Main App Views
  return (
    <div>
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <h1 className="header-title">Pulse</h1>
          <div className="header-user">
            <span className="username-display">@{currentUser?.username}</span>
            <button onClick={handleLogout} className="logout-btn">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="main-content">
        {activeView === 'home' && (
          <div className="feed-container">
            {posts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
                <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>No posts yet!</p>
                <p>Be the first to share something</p>
              </div>
            ) : (
              posts.map(post => {
                const author = getUserById(post.userId);














                return (
                  <div key={post.id} className="post-card">
                    <div className="post-header">
                      <div className="avatar">
                        {author?.avatar || author?.name?.[0]}
                      </div>
                      <div className="user-info">
                        <h3>{author?.name || "unknown user"}</h3>
                        <p>@{author?.username || "unknown"}</p>
                      </div>
                    </div>

                    {post.mediaUrl && (
                      <div className="post-media">
                        {post.mediaType === 'image' && (
                          <img src={post.mediaUrl} alt="Post" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        )}
                        {post.mediaType === 'video' && (
                          <video src={post.mediaUrl} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        )}
                      </div>
                    )}

                    <div className="post-content">
                      <div className="post-actions">
                        <button
                          onClick={() => toggleLike(post.id, post.likes)}
                          className={`action-btn ${post.likes.includes(currentUser.id) ? 'liked' : ''}`}
                        >
                          <Heart size={24} fill={post.likes.includes(currentUser.id) ? 'currentColor' : 'none'} />
                          <span>{post.likes.length}</span>
                        </button>
                        <button className="action-btn">
                          <MessageCircle size={24} />
                          <span>{post.comments.length}</span>
                        </button>
                        <button className="action-btn">
                          <Send size={24} />
                        </button>

                        {post.userId === currentUser.id && (
  <button
    onClick={() => deletePost(post.id)}
    className="action-btn delete-btn"
    style={{ color: 'red' }}
  >
    Delete
  </button>
)}

                      </div>

                      <div className="post-text">
                        <span className="username">{author?.username}</span>
                        {post.text}
                      </div>

                      {post.comments.map(comment => {
                        const commenter = getUserById(comment.userId);
                        return (
                          <div key={comment.id} className="comment">
                            <span className="username">{commenter?.username}</span>
                            {comment.text}
                          </div>
                        );
                      })}

                      <input
                        type="text"
                        placeholder="Add a comment..."
                        className="comment-input"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            addComment(post.id, e.target.value);
                            e.target.value = '';
                          }
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeView === 'search' && (
          <div className="search-container">
            <input
              type="text"
              placeholder="Search users..."
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="user-list">
              {filteredUsers.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#6b7280', padding: '2rem' }}>
                  {searchQuery ? 'No users found' : 'No other users yet'}
                </p>
              ) : (
                filteredUsers.map(user => (
                  <div
                    key={user.id}
                    onClick={() => {
                      setSelectedProfile(user);
                      setActiveView('profile');
                    }}
                    className="user-item"
                  >
                    <div className="avatar avatar-lg">
                      {user.avatar || user.name[0]}
                    </div>
                    <div className="user-info">
                      <h3>{user.name}</h3>
                      <p>@{user.username}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeView === 'profile' && selectedProfile && (
          <div>
            <div className="profile-container">
              <button onClick={() => setActiveView('home')} className="back-btn">
                <ArrowLeft size={24} />
              </button>
              <div className="profile-header">
                <div className="avatar avatar-xl">
                  {selectedProfile.avatar || selectedProfile.name[0]}
                </div>
                <div className="profile-info">
                  <h2 className="profile-name">{selectedProfile.name}</h2>
                  <p className="profile-username">@{selectedProfile.username}</p>
                  <p className="profile-bio">{selectedProfile.bio || 'No bio yet'}</p>
                  <div className="profile-stats">
                    <div><span>{userPosts.length}</span> posts</div>
                    <div><span>0</span> followers</div>
                    <div><span>0</span> following</div>
                    
                  </div>
                  {selectedProfile.id !== currentUser.id && (
                    <>
                     <button
      onClick={() => toggleFollow(selectedProfile)}
      className="btn-follow"
    >
      {currentUser.following?.includes(selectedProfile.id)
        ? 'Unfollow'
        : 'Follow'}
    </button>
                    <button
                      onClick={() => {
                        setActiveChat(selectedProfile);
                        setActiveView('messages');
                      }}
                      className="btn-message"
                    >
                      Message
                    </button>

</>


                  )}
                </div>
                
              </div>
            </div>

            <div className="post-grid">
              {userPosts.map(post => (
                <div key={post.id} className="grid-item">
                  {post.mediaType === 'image' && post.mediaUrl ? (
                    <img src={post.mediaUrl} alt="Post" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '0.25rem' }} />
                  ) : post.mediaType === 'video' && post.mediaUrl ? (
                    <video src={post.mediaUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '0.25rem' }} />
                  ) : (
                    '📝'
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeView === 'messages' && (
          <div className="messages-container">
            {activeChat ? (
              <>
                <div className="chat-header">
                  <button onClick={() => setActiveChat(null)} className="back-btn">
                    <ArrowLeft size={24} />
                  </button>
                  <div className="avatar">
                    {activeChat.avatar || activeChat.name[0]}
                  </div>
                  <div className="user-info">
                    <h3>{activeChat.name}</h3>
                    <p>@{activeChat.username}</p>
                  </div>
                </div>

                <div className="chat-messages">
                  {chatMessages.map(msg => (
                    <div key={msg.id} className={`message-wrapper ${msg.senderId === currentUser.id ? 'sent' : 'received'}`}>
                      <div className={`message-bubble ${msg.senderId === currentUser.id ? 'sent' : 'received'}`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="chat-input-container">
                  <input
                    type="text"
                    placeholder="Type a message..."
                    className="message-input"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  />
                  <button onClick={sendMessage} className="btn-send">
                    <Send size={20} />
                  </button>
                </div>
              </>
            ) : (
              <div className="search-container">
                <h2 className="modal-title">Messages</h2>
                <div className="user-list">
                  {users.filter(u => u.id !== currentUser.id).map(user => (
                    <div
                      key={user.id}
                      onClick={() => setActiveChat(user)}
                      className="user-item"
                    >
                      <div className="avatar avatar-lg">
                        {user.avatar || user.name[0]}
                      </div>
                      <div className="user-info">
                        <h3>{user.name}</h3>
                        <p>@{user.username}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeView === 'userProfile' && (
          <div>
            <div className="profile-container">
              <div className="profile-header">
                <div className="avatar avatar-xl">
                  {currentUser.avatar || currentUser.name[0]}
                </div>
                <div className="profile-info">
                  <h2 className="profile-name">{currentUser.name}</h2>
                  <p className="profile-username">@{currentUser.username}</p>
            
                <div className="profile-stats">
  <div><span>{posts.filter(p => p.userId === currentUser.id).length}</span> posts</div>
  <div><span>{currentUser.followers?.length || 0}</span> followers</div>
  <div><span>{currentUser.following?.length || 0}</span> following</div>
</div>

                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Create Post Modal */}
      {showCreatePost && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Create Post</h3>
              <button onClick={() => setShowCreatePost(false)} className="btn-close">
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <textarea
                placeholder="What's on your mind?"
                className="post-textarea"
                rows="4"
                value={newPost.text}
                onChange={(e) => setNewPost({ ...newPost, text: e.target.value })}
              />

              {newPost.mediaUrl && (
                <div style={{ marginBottom: '1rem', position: 'relative' }}>
                  <button
                    onClick={() => setNewPost({ ...newPost, mediaUrl: '', mediaType: null, mediaFile: null })}
                    style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <X size={20} />
                  </button>
                </div>
              )}

            
              <button onClick={createPost} disabled={loading} className="btn-post">
                {loading ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <div className="nav-content">
          <button onClick={() => setActiveView('home')} className={`nav-btn ${activeView === 'home' ? 'active' : ''}`}>
            <Home size={28} />
          </button>
          <button onClick={() => setActiveView('search')} className={`nav-btn ${activeView === 'search' ? 'active' : ''}`}>
            <Search size={28} />
          </button>
          <button onClick={() => setShowCreatePost(true)} className="nav-btn">
            <PlusSquare size={28} />
          </button>
          <button onClick={() => setActiveView('messages')} className={`nav-btn ${activeView === 'messages' ? 'active' : ''}`}>
            <MessageCircle size={28} />
          </button>
          <button onClick={() => setActiveView('userProfile')} className={`nav-btn ${activeView === 'userProfile' ? 'active' : ''}`}>
            <User size={28} />
          </button>
        </div>
      </nav>
    </div>
  );
};

export default SocialMediaApp;