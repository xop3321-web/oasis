import {configured} from '../server/storage.mjs';
export default function handler(req,res){res.setHeader('Cache-Control','no-store');res.status(200).json({configured:configured()});}
