import express from 'express';
import { User } from '../src/db/entities/User.ts';
import { Shop } from '../src/db/entities/Shop.ts';

interface pagination {
    page: string;
    pageSize: string;
    q: string
    category?: string;
    shopId?: number;
}

namespace ExpressNS {
    export interface RequestWithUser extends express.Request {
        user?: User;
    }
    export interface RequestWithShop extends express.Request {
        shop?: Shop;
    }
}
