import { db } from "./firebase";
import {
  collection, addDoc, updateDoc, doc,
  onSnapshot, query, orderBy, where,
  serverTimestamp, Timestamp, deleteDoc,
} from "firebase/firestore";
import { KitchenTask } from "@/types";

const tasksRef = collection(db, "kitchenTasks");

// Crea task per la cucina
export const createKitchenTask = async (
  task: Omit<KitchenTask, "id" | "createdAt">
) => {
  const ref = await addDoc(tasksRef, {
    ...task,
    createdAt: serverTimestamp(),
  });
  return ref.id;
};

// Completa task (sparisce dalla vista cucina)
export const completeTask = async (taskId: string) => {
  await updateDoc(doc(db, "kitchenTasks", taskId), { completed: true });
};

// Elimina task
export const deleteTask = async (taskId: string) => {
  await deleteDoc(doc(db, "kitchenTasks", taskId));
};

// Ascolta task attivi per zona
export const subscribeToTasks = (
  zone: "cucina" | "fritture",
  callback: (tasks: KitchenTask[]) => void
) => {
  const q = query(
    tasksRef,
    where("zone", "==", zone),
    where("completed", "==", false),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: (d.data().createdAt as Timestamp)?.toDate() ?? new Date(),
    })) as KitchenTask[];
    callback(tasks);
  });
};

// Ascolta task completati recenti (ultimi 30)
export const subscribeToCompletedTasks = (
  zone: "cucina" | "fritture",
  callback: (tasks: KitchenTask[]) => void
) => {
  const q = query(
    tasksRef,
    where("zone", "==", zone),
    where("completed", "==", true),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.slice(0, 20).map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: (d.data().createdAt as Timestamp)?.toDate() ?? new Date(),
    })) as KitchenTask[];
    callback(tasks);
  });
};