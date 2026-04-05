import { Redirect } from "expo-router";

export default function CategoriesScreen() {
  return <Redirect href={{ pathname: "/home", params: { tab: "categories" } }} />;
}
