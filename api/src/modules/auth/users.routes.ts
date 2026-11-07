import { Router } from 'express';
import { db } from '../../db/knex.js';

/** GET /users — the team (to assign tickets, filter by owner). Names and e-mails only. */
export function usersRouter(): Router {
  const router = Router();
  router.get('/', async (_req, res) => {
    res.json({ items: await db('users').where({ isActive: true }).orderBy('fullName').select('id', 'fullName', 'email', 'role') });
  });
  return router;
}
