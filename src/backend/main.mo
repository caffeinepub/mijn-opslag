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

  public type UserProfile = {
    name : Text;
  };

  let files = Map.empty<Principal, List.List<FileMetadata>>();
  let userProfiles = Map.empty<Principal, UserProfile>();
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);
  include MixinStorage();

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized");
    };
    userProfiles.add(caller, profile);
  };

  public shared ({ caller }) func uploadFile(fileMetadata : FileMetadata) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized");
    };
    let newFile : FileMetadata = {
      id = fileMetadata.id;
      name = fileMetadata.name;
      description = fileMetadata.description;
      size = fileMetadata.size;
      uploadTime = Time.now();
      content = fileMetadata.content;
      user = caller;
    };
    let currentFiles = switch (files.get(caller)) {
      case (null) { List.empty<FileMetadata>() };
      case (?list) { list };
    };
    currentFiles.add(newFile);
    files.add(caller, currentFiles);
  };

  public query ({ caller }) func getFiles(user : Principal) : async [FileMetadata] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized");
    };
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized");
    };
    switch (files.get(user)) {
      case (null) { [] };
      case (?fileList) { fileList.toArray() };
    };
  };

  public shared ({ caller }) func deleteFile(id : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized");
    };
    switch (files.get(caller)) {
      case (null) { Runtime.trap("No files found") };
      case (?userFileList) {
        let filteredFiles = userFileList.filter(func(file) { file.id != id });
        files.add(caller, filteredFiles);
      };
    };
  };
};
