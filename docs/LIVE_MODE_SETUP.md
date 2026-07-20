# Live Class Mode — setup (plain-language guide)

This covers the **one thing you need to do yourself** to make Live Class Mode safe for a real
classroom: updating the Firebase security rules. It also explains how hosting works.

---

## 1. Update the Firebase security rules (do this once)

Right now your Firebase database is in **"test mode"** — anyone can read or write anything. That's
fine while we build, but before you use it with a class you should paste in the stricter rules I
wrote (the file `firestore.rules` in this project).

**What the new rules do, in plain words:**
- People can still join rooms and play (no logins needed).
- Nobody can mess with a *different* room, delete a room, or secretly change an answer after
  sending it.
- Nobody can inflate the scoreboard from outside the game.
- The only remaining risk (you chose the simple option): a student who already knows the room
  code *could* answer under a classmate's name. For a normal classroom that's a minor issue.

**How to paste them in (about 1 minute):**
1. Go to **https://console.firebase.google.com/** and open the **skillbee-gamification** project.
2. In the left menu click **Build → Firestore Database**.
3. Click the **Rules** tab (near the top).
4. Delete everything in the box, then **paste the entire contents of `firestore.rules`** from this
   project.
5. Click **Publish**.

That's it. If you ever see a message like "Missing or insufficient permissions" during a game,
it usually means the rules need re-publishing — tell me and I'll help.

---

## 2. Hosting — how teachers and students reach the game

Live Class Mode needs the **online version** of the app (it can't run from the offline file,
because it has to talk to Firebase in real time).

- Turn on the **GitHub Pages link** (Settings → Pages → Deploy from a branch). You get a URL like
  `https://vin1764.github.io/Skillbee_AIfication/`.
- **Teacher:** open that link on the smartboard → **Live Class Mode → Host a class**.
- **Students:** open the *same* link on their phones → **Live Class Mode → Join a game**, then type
  the room code shown on the smartboard.

---

## 3. The teacher PIN

Hosting a live class and opening the content editor are protected by a **4-digit teacher PIN** so
students can't reach them.

- **First time:** the first person to Host or open the editor is asked to **create** the PIN
  (enter it twice). Do this yourself during setup so *you* choose it.
- After that, hosting/editing asks for the PIN. Students don't know it, so they can't host or edit.
- Once you enter it, your device stays unlocked for that browser session.
- **Change it** anytime from the content editor's toolbar (**🔒 PIN**).

It's a light gate, not a bank vault — but combined with the fact that student edits only ever
affect their own phone, it's plenty for a classroom.

## 4. A note on the Firebase key in the code

You'll see the Firebase configuration (including `apiKey`) sitting in `js/live/firebase.js`. That
is **normal and safe** — Firebase web keys are public by design and are sent to every browser that
loads the app. Your protection comes from the security rules in step 1, not from hiding the key.
