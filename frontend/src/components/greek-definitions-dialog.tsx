"use client";

import { BookOpen } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GreekDefinitionsList } from "@/components/greek-definitions";

/** "What each Greek means" button in the header → opens definitions in a modal. */
export function GreekDefinitionsDialog() {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            className="w-full border-red-900 text-red-900 hover:bg-red-50 hover:text-red-900 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-400"
          />
        }
      >
        <BookOpen className="mr-2 h-4 w-4" />
        What each Greek means
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>What each Greek means</DialogTitle>
        </DialogHeader>
        <div className="mt-2">
          <GreekDefinitionsList />
        </div>
      </DialogContent>
    </Dialog>
  );
}
