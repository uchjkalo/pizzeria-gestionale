import { db } from "./firebase";
import {
  collection, addDoc, updateDoc, doc,
  onSnapshot, query, orderBy, where,
  serverTimestamp, Timestamp, deleteDoc,
} from "firebase/firestore";
import { KitchenTask } from "@/types";

const tasksRef = collection(db, "kitchenTasks");

export const createKitchenTask = async (
  task: Omit<KitchenTask, "id" | "createdAt">
) => {
  const ref = await addDoc(tasksRef, { ...task, createdAt: serverTimestamp() });
  return ref.id;
};

export const completeTask = async (taskId: string) => {
  await updateDoc(doc(db, "kitchenTasks", taskId), { completed: true });
};

export const uncompleteTask = async (taskId: string) => {
  await updateDoc(doc(db, "kitchenTasks", taskId), { completed: false });
};

export const deleteTask = async (taskId: string) => {
  await deleteDoc(doc(db, "kitchenTasks", taskId));
};

export const updateTaskDescription = async (taskId: string, description: string) => {
  await updateDoc(doc(db, "kitchenTasks", taskId), { description });
};

const mapTask = (d: any): KitchenTask => ({
  id: d.id, ...d.data(),
  createdAt: (d.data().createdAt as Timestamp)?.toDate() ?? new Date(),
});

export const subscribeToTasks = (
  zone: "cucina" | "fritture" | "preparazione",
  callback: (tasks: KitchenTask[]) => void
) => {
  const q = query(tasksRef,
    where("zone", "==", zone), where("completed", "==", false), orderBy("createdAt", "asc"));
  return onSnapshot(q, snap => callback(snap.docs.map(mapTask) as KitchenTask[]));
};

export const subscribeToCompletedTasks = (
  zone: "cucina" | "fritture" | "preparazione",
  callback: (tasks: KitchenTask[]) => void
) => {
  const q = query(tasksRef,
    where("zone", "==", zone), where("completed", "==", true), orderBy("createdAt", "desc"));
  return onSnapshot(q, snap => callback(snap.docs.slice(0, 30).map(mapTask) as KitchenTask[]));
};

export const subscribeToAllTasks = (
  zone: "cucina" | "fritture" | "preparazione",
  callback: (tasks: KitchenTask[]) => void
) => {
  const q = query(tasksRef, where("zone", "==", zone), orderBy("createdAt", "desc"));
  return onSnapshot(q, snap => callback(snap.docs.map(mapTask) as KitchenTask[]));
};
