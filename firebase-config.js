// ==================== FIREBASE CONFIGURATION ====================
// Config local-first: localStorage + optional Firebase (não obrigatório para local)
// Removido Netlify deps conforme instrução do usuário

// ==================== FIREBASE CONFIGURATION (LOCAL-ONLY) ====================
// Removido Netlify deps. Usa apenas localStorage.

let db = null;
let auth = null;

async function initializeFirebase() {
    console.log('🔧 Firebase: Modo LocalStorage ativado (sem cloud)');
    return false;
}


async function initializeFirebase() {
    try {
        if (!window.firebase) {
            console.warn('Firebase SDK não carregado. Usando localStorage como fallback.');
            return false;
        }
        
        db = firebase.firestore();
        auth = firebase.auth();
        
        // Escutar mudanças de autenticação
        firebase.auth().onAuthStateChanged(user => {
            if (user) {
                app.currentUser = {
                    id: user.uid,
                    email: user.email,
                    name: user.displayName || user.email.split('@')[0],
                    photoURL: user.photoURL,
                    currency: localStorage.getItem('currency') || 'BRL',
                    monthlyBudget: parseFloat(localStorage.getItem('monthlyBudget')) || 0
                };
                app.currentPage = 'dashboard';
                syncExpensesFromFirebase();
            } else {
                app.currentUser = null;
                app.currentPage = 'login';
            }
            app.render();
        });
        
        return true;
    } catch (error) {
        console.error('Erro ao inicializar Firebase:', error);
        return false;
    }
}

// ==================== FIRESTORE OPERATIONS ====================

async function saveExpenseToFirebase(expense) {
    if (!app.currentUser || !db) {
        // Fallback para localStorage
        app.addExpense(expense);
        return;
    }
    
    try {
        const docRef = await db.collection('users')
            .doc(app.currentUser.id)
            .collection('expenses')
            .add({
                ...expense,
                userId: app.currentUser.id,
                createdAt: firebase.firestore.Timestamp.now()
            });
        
        return docRef.id;
    } catch (error) {
        console.error('Erro ao salvar despesa:', error);
        app.addExpense(expense); // Fallback
    }
}

async function updateExpenseInFirebase(expenseId, updates) {
    if (!app.currentUser || !db) {
        app.updateExpense(expenseId, updates);
        return;
    }
    
    try {
        await db.collection('users')
            .doc(app.currentUser.id)
            .collection('expenses')
            .doc(expenseId)
            .update({
                ...updates,
                updatedAt: firebase.firestore.Timestamp.now()
            });
    } catch (error) {
        console.error('Erro ao atualizar despesa:', error);
        app.updateExpense(expenseId, updates); // Fallback
    }
}

async function deleteExpenseFromFirebase(expenseId) {
    if (!app.currentUser || !db) {
        app.deleteExpense(expenseId);
        return;
    }
    
    try {
        await db.collection('users')
            .doc(app.currentUser.id)
            .collection('expenses')
            .doc(expenseId)
            .delete();
    } catch (error) {
        console.error('Erro ao deletar despesa:', error);
        app.deleteExpense(expenseId); // Fallback
    }
}

async function syncExpensesFromFirebase() {
    if (!app.currentUser || !db) return;
    
    try {
        const snapshot = await db.collection('users')
            .doc(app.currentUser.id)
            .collection('expenses')
            .orderBy('createdAt', 'desc')
            .get();
        
        app.expenses = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt.toDate().toISOString()
        }));
        
        localStorage.setItem('expenses', JSON.stringify(app.expenses));
    } catch (error) {
        console.error('Erro ao sincronizar despesas:', error);
    }
}

async function saveUserProfileToFirebase(userUpdates) {
    if (!app.currentUser || !db) {
        app.updateProfile(userUpdates);
        return;
    }
    
    try {
        await db.collection('users')
            .doc(app.currentUser.id)
            .set({
                email: app.currentUser.email,
                name: userUpdates.name || app.currentUser.name,
                currency: userUpdates.currency || app.currentUser.currency,
                monthlyBudget: userUpdates.monthlyBudget ?? app.currentUser.monthlyBudget,
                photoURL: app.currentUser.photoURL,
                updatedAt: firebase.firestore.Timestamp.now()
            }, { merge: true });
        
        app.updateProfile(userUpdates);
    } catch (error) {
        console.error('Erro ao salvar perfil:', error);
        app.updateProfile(userUpdates); // Fallback
    }
}

// ==================== GOOGLE AUTHENTICATION ====================

async function loginWithGoogle() {
    if (!auth) return false;
    
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await firebase.auth().signInWithPopup(provider);
        return result;
    } catch (error) {
        console.error('Erro no login com Google:', error);
        return null;
    }
}

async function logout() {
    if (auth) {
        try {
            await firebase.auth().signOut();
        } catch (error) {
            console.error('Erro ao fazer logout:', error);
        }
    }
    app.logout();
}

// Firestore Security Rules (copie para seu Firebase Console):
/*
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Apenas usuários autenticados podem acessar seus dados
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
      match /expenses/{expenseId} {
        allow read, write: if request.auth.uid == userId;
      }
    }
  }
}
*/
