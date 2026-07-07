rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuth() { return request.auth != null; }
    function isAdmin() {
      return isAuth() && request.auth.token.email.matches('.*@bazookabreaks\\.com');
    }
    function isSwancityMod() {
      return isAuth() && request.auth.token.email.lower() == 'swancitycards@gmail.com';
    }
    match /quotes/{quoteId} {
      allow read: if true;
      allow create: if true;
      allow update: if isAdmin()
                    || (
                         resource != null &&
                         request.resource.data.diff(resource.data).affectedKeys()
                           .hasOnly(['viewCount','lastViewedAt','status','sellerCounter',
                                     'sellerPayment','sellerHandle','respondedAt','notified','history'])
                       );
      allow delete: if isAdmin();
    }
    match /boba_cards/{doc}     { allow read: if true; allow write: if isAdmin(); }
    match /boba_checklist/{doc} { allow read: if true; allow write: if isAdmin(); }

    // Collector's own collection — LOCKED to the owner (doc id == uid)
    match /boba_owned/{uid}   { allow read: if true; allow write: if isAuth() && request.auth.uid == uid; }
    match /boba_wants/{uid}   { allow read, write: if isAuth() && request.auth.uid == uid; }
    match /boba_private/{uid} { allow read, write: if isAuth() && request.auth.uid == uid; }
    match /boba_public/{uid}    { allow read: if true; allow write: if isAuth() && request.auth.uid == uid; }
    match /boba_profiles/{uid}  { allow read: if true; allow write: if isAuth() && request.auth.uid == uid; }
    match /boba_lots/{uid}      { allow read, write: if isAuth() && request.auth.uid == uid; }

    // Decks & playbooks — arbitrary doc id, owner stored in userId field
    match /boba_decks/{doc} {
      allow read: if isAuth();
      allow create: if isAuth() && request.resource.data.userId == request.auth.uid;
      allow update, delete: if isAuth() && resource.data.userId == request.auth.uid;
    }
    match /boba_playbooks/{doc} {
      allow read: if isAuth();
      allow create: if isAuth() && request.resource.data.userId == request.auth.uid;
      allow update, delete: if isAuth() && resource.data.userId == request.auth.uid;
    }

    // Import scratch buffers (transient, no owner field) — signed-in only
    match /boba_imports/{doc}   { allow read, write: if isAuth(); }

    match /boba_reviews/{doc}   { allow read: if true; allow write: if isAuth(); }

    // Public profile data — anonymous read, owner writes
    match /boba_public_cards/{uid} { allow read: if true; allow write: if isAuth() && request.auth.uid == uid; }
    match /boba_trackers/{uid}     { allow read: if true; allow write: if isAuth() && request.auth.uid == uid; }
    // In-transit shows on public profiles (yellow "on the way") — public read, owner write
    match /boba_intransit/{uid}    { allow read: if true; allow write: if isAuth() && request.auth.uid == uid; }
    // Trade bait — private to the owner
    match /boba_tradebait/{uid}    { allow read, write: if isAuth() && request.auth.uid == uid; }

    match /sim_pulls/{doc} { allow read: if true; allow create: if true; allow delete: if isAdmin(); }
    match /super_claims/{doc} {
      allow read: if true;
      allow create: if isAdmin() || isSwancityMod() || (request.resource.data.status == 'pending');
      allow update, delete: if isAdmin() || isSwancityMod();
    }
    match /oneof1_claims/{doc} {
      allow read: if true;
      allow create: if isAdmin() || isSwancityMod() || (request.resource.data.status == 'pending');
      allow update, delete: if isAdmin() || isSwancityMod();
    }
    match /bojax34_claims/{serial} {
      allow read: if true;
      allow create: if isAdmin() || isSwancityMod() || (request.resource.data.status == 'pending');
      allow update, delete: if isAdmin() || isSwancityMod();
    }
    match /chase_submissions/{doc}  { allow read: if true; allow write: if isAuth(); }
    match /chases/{doc}             { allow read: if true; allow write: if isAuth(); }

    // Social / marketplace — multi-party (participant checks still TODO)
    match /friend_requests/{doc}     { allow read, write: if isAuth(); }
    match /teams/{doc}               { allow read, write: if isAuth(); }
    match /team_invites/{doc}        { allow read, write: if isAuth(); }
    match /marketplace/{doc}         { allow read: if true; allow write: if isAuth(); }
    match /market_offers/{doc}       { allow read, write: if isAuth(); }
    match /market_sales/{doc}        { allow read, write: if isAuth(); }
    match /market_notifs/{doc}       { allow read, write: if isAuth(); }
    match /deal_threads/{doc}        { allow read, write: if isAuth(); }
    match /thread_messages/{doc}     { allow read, write: if isAuth(); }
    match /negotiation_history/{doc} { allow read, write: if isAuth(); }
    match /treatment_visuals/{doc} { allow read, write: if isAuth(); }

    match /users/{uid}        { allow read: if true; allow write: if isAuth() && request.auth.uid == uid; }
    match /usernames/{handle} { allow read: if true; allow write: if isAuth(); }
    match /missing_cards/{doc} { allow read, write: if isAuth(); }
    match /user_missing/{uid}  { allow read, write: if isAuth() && request.auth.uid == uid; }
    match /meta/{doc} { allow read: if true; allow write: if isAdmin(); }
    match /bug_reports/{doc} {
      allow create: if true;
      allow read, update, delete: if isAdmin();
    }

    // Live DBS overrides — public read (instant DBS for everyone), admin write.
    // MUST come before the general config rule below.
    match /config/dbs_overrides { allow read: if true; allow write: if isAdmin(); }

    // ── INTERNAL BUSINESS collections — ADMIN ONLY (@bazookabreaks.com) ──
    match /streams/{doc}             { allow read, write: if isAdmin(); }
    match /planned_streams/{doc}     { allow read, write: if isAdmin(); }
    match /breaker_vacations/{doc}   { allow read, write: if isAdmin(); }
    match /stream_templates/{doc}    { allow read, write: if isAdmin(); }
    match /breaks/{doc}              { allow read, write: if isAdmin(); }
    match /inventory/{doc}           { allow read, write: if isAdmin(); }
    match /card_pools/{doc}          { allow read, write: if isAdmin(); }
    match /comps/{doc}               { allow read, write: if isAdmin(); }
    match /pay_stubs/{doc}           { allow read, write: if isAdmin(); }
    match /buyers/{doc}              { allow read, write: if isAdmin(); }
    match /buyer_imports/{doc}       { allow read, write: if isAdmin(); }
    match /csv_imports/{doc}         { allow read, write: if isAdmin(); }
    match /historical_data/{doc}     { allow read, write: if isAdmin(); }
    match /shipments/{doc}           { allow read, write: if isAdmin(); }
    match /shipping_issues/{doc}     { allow read, write: if isAdmin(); }
    match /product_usage/{doc}       { allow read, write: if isAdmin(); }
    match /sku_price_history/{doc}   { allow read, write: if isAdmin(); }
    match /follower_snapshots/{doc}  { allow read, write: if isAdmin(); }
    match /cash_expenses/{doc}       { allow read, write: if isAdmin(); }
    match /directory/{doc}           { allow read, write: if isAdmin(); }
    match /player_notes/{doc}        { allow read, write: if isAdmin(); }

    // Config — read for signed-in (app settings), admin write
    match /config/{doc} { allow read: if isAuth(); allow write: if isAdmin(); }
    // Catch-all — deny to non-admins by default
    match /{document=**} { allow read, write: if isAdmin(); }
  }
}
