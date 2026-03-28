import MixinStorage "blob-storage/Mixin";
import Storage "blob-storage/Storage";
import Map "mo:core/Map";
import Iter "mo:core/Iter";
import Principal "mo:core/Principal";
import Time "mo:core/Time";
import List "mo:core/List";
import Runtime "mo:core/Runtime";
import Order "mo:core/Order";
import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";

actor {
  type FileMetadata = {
    id : Text;
    name : Text;
    description : Text;
    size : Nat;
    uploadTime : Time.Time;
    content : Blob;
    user : Principal;
  };

  module FileMetadata {
    public func compare(a : FileMetadata, b : FileMetadata) : Order.Order {
      Text.compare(a.id, b.id);
    };
  };

  public type UserProfile = {
    name : Text;
  };

  let files = Map.empty<Principal, List.List<FileMetadata>>();
  let userProfiles = Map.empty<Principal, UserProfile>();
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);
  include MixinStorage();

  // User profile functions
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  // Upload file (content, name, size, and description)
  public shared ({ caller }) func uploadFile(fileMetadata : FileMetadata) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can upload files");
    };

    // Create file with caller as owner, ignoring the user field from input
    let newFile : FileMetadata = {
      id = fileMetadata.id;
      name = fileMetadata.name;
      description = fileMetadata.description;
      size = fileMetadata.size;
      uploadTime = Time.now();
      content = fileMetadata.content;
      user = caller; // Always use caller as the owner
    };

    let currentFiles = switch (files.get(caller)) {
      case (null) { List.empty<FileMetadata>() };
      case (?list) { list };
    };
    currentFiles.add(newFile);
    files.add(caller, currentFiles);
  };

  // Get all files for a user
  public query ({ caller }) func getFiles(user : Principal) : async [FileMetadata] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view files");
    };

    // Users can only view their own files, admins can view any user's files
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own files");
    };

    switch (files.get(user)) {
      case (null) { [] }; // Return empty array instead of trapping
      case (?fileList) { fileList.toArray().sort() };
    };
  };

  // Delete file
  public shared ({ caller }) func deleteFile(id : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can delete files");
    };

    // Users can only delete their own files
    switch (files.get(caller)) {
      case (null) { Runtime.trap("No files found for user") };
      case (?userFileList) {
        let filteredFiles = userFileList.filter(
          func(file) { file.id != id }
        );
        files.add(caller, filteredFiles);
      };
    };
  };
};
