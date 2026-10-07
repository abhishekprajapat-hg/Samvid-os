import type { LinkingOptions } from "@react-navigation/native";
import * as Linking from "expo-linking";
import { getWebAppOrigin } from "../services/api";

/*
 * Deep links.
 *
 * Two jobs. A push notification carries a `url` in its payload - the same
 * relative path the web app would navigate to - and tapping it has to land on
 * the record rather than the home screen. And a share link opened on a phone
 * with the app installed should open in the app.
 *
 * The paths below are the web routes from workbenchNavigation.js, so one link
 * works on both apps.
 */

const scheme = "theofficeonrent://";

export const linking = {
  prefixes: [Linking.createURL("/"), scheme, getWebAppOrigin()],
  config: {
    screens: {
      // Signed out: the two documents a store reviewer looks for, plus a
      // share link, all reachable without an account.
      Login: "login",
      Privacy: "privacy-policy",
      Terms: "terms-and-conditions",
      SharedInventory: "shared/inventory/:shareToken",

      MainTabs: {
        screens: {
          Dashboard: "dashboard",
          Leads: "leads",
          Inventory: "inventory",
          Chat: "chat",
          More: "more",
        },
      },

      LeadDetails: "leads/:leadId",
      InventoryDetails: "inventory/:assetId",
      ProjectDetails: "projects/:projectId",
      Projects: "projects",
      OwnerDatabase: "inventory/owners",
      BrokerDatabase: "inventory/brokers",
      Tasks: "tasks",
      Attendance: "attendance",
      Calendar: "calendar",
      Finance: "finance",
      Reports: "reports",
      Leaderboard: "leaderboard",
      Targets: "targets",
      "Field Ops": "map",
      Users: "admin/users",
      UserDetails: "admin/users/:userId",
      Console: "admin/console",
      MetaAds: "admin/meta-ads",
      Notifications: "admin/notifications",
      Settings: "settings",
      Profile: "profile",
      // Web keeps the open cabin and client in the query string
      // (?cabin=C12, ?client=nexbridge); React Navigation hands a query
      // parameter to the screen as a route param of the same name.
      CoworkingBooking: "coworking/booking-board",
      CoworkingClients: "coworking/clients",
      ChatConversation: "chat/:conversationId",
    },
  },
} as LinkingOptions<Record<string, never>>;
